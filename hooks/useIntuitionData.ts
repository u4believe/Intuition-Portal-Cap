import { useQuery } from '@tanstack/react-query'

export interface LiveEvent {
  id: string
  type: 'deposit' | 'redemption'
  senderId?: string
  receiverId?: string
  assets: number
  atomLabel: string
  createdAt: string
}

export interface Claim {
  termId: string
  label: string
  type: string
  image: string | null
  subjectLabel: string
  subjectType: string
  predicateLabel: string
  predicateType: string
  objectLabel: string
  objectType: string
  marketCap: number
  totalShares: number
  currentSharePrice: number
  totalAssets: number
  positionCount: number
  sharePriceChange24h: number
  deposits: Array<{
    id: string
    createdAt: string
    shares: number
  }>
  redemptions: Array<{
    id: string
    createdAt: string
    shares: number
  }>
  positions: Array<{
    accountId: string
    shares: number
    totalDepositAssetsAfterTotalFees: number
    totalRedeemAssetsForReceiver: number
  }>
}

export function useRecentEvents() {
  return useQuery({
    queryKey: ['recentEvents'],
    queryFn: async () => {
      const response = await fetch('/api/recent-events')
      if (!response.ok) throw new Error('Failed to fetch recent events')
      const data = await response.json()
      return data.events || []
    },
    staleTime: 10000, // 10 seconds for live updates
    refetchInterval: 10000,
  })
}

export function useAllClaims(limit: number = 1000) {
  return useQuery({
    queryKey: ['allClaims', limit],
    queryFn: async () => {
      const response = await fetch(`/api/all-claims-holders?limit=${limit}`)
      if (!response.ok) throw new Error('Failed to fetch claims')
      const data = await response.json()
      return data.claims || []
    },
    staleTime: 86400000, // 24 hours
  })
}

export function useTopClaims() {
  return useQuery({
    queryKey: ['topClaims'],
    queryFn: async () => {
      const response = await fetch('/api/top-claims')
      if (!response.ok) throw new Error('Failed to fetch top claims')
      const data = await response.json()
      return data.claims || []
    },
    staleTime: 86400000, // 24 hours
  })
}

export function useTriples(limit: number = 1000) {
  return useQuery({
    queryKey: ['triples', limit],
    queryFn: async () => {
      const response = await fetch(`/api/top-triples?limit=${limit}`)
      if (!response.ok) throw new Error('Failed to fetch triples')
      const data = await response.json()
      return data.triples || []
    },
    staleTime: 86400000, // 24 hours
  })
}

export function useAtoms(limit: number = 1000) {
  return useQuery({
    queryKey: ['atoms', limit],
    queryFn: async () => {
      const response = await fetch(`/api/top-atoms?limit=${limit}`)
      if (!response.ok) throw new Error('Failed to fetch atoms')
      const data = await response.json()
      
      // Transform API response to match Claim interface
      return (data.atoms || []).map((atom: any) => ({
        termId: '', // Atoms don't have a direct termId, they're aggregated
        label: atom.label || 'Unknown',
        type: 'Atom',
        image: atom.image || null,
        subjectLabel: '',
        subjectType: '',
        predicateLabel: '',
        predicateType: '',
        objectLabel: '',
        objectType: '',
        marketCap: atom.marketCap || 0,
        totalShares: atom.totalShares || 0,
        currentSharePrice: atom.currentSharePrice || 0,
        totalAssets: atom.totalAssets || 0,
        positionCount: atom.positionCount || 0,
        sharePriceChange24h: atom.sharePriceChange24h || 0,
        creatorLabel: '',
        deposits: [],
        redemptions: [],
        positions: (atom.positions || []).map((pos: any) => ({
          accountId: pos.account_id || '',
          shares: (pos.shares || 0) / 1e18,
          totalDepositAssetsAfterTotalFees: (pos.total_deposit_assets_after_total_fees || 0) / 1e18,
          totalRedeemAssetsForReceiver: (pos.total_redeem_assets_for_receiver || 0) / 1e18,
        })),
      }))
    },
    staleTime: 86400000, // 24 hours
  })
}
