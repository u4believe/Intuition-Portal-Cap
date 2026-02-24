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

function isUnknownEntry(item: any): boolean {
  const label = (item.label || '').toLowerCase().trim()
  if (label === 'unknown') return true
  if (/^(unknown\s*[-–—]\s*)+unknown$/i.test(label)) return true
  const subjectLabel = (item.subjectLabel || item.subject_label || '').toLowerCase().trim()
  const predicateLabel = (item.predicateLabel || item.predicate_label || '').toLowerCase().trim()
  const objectLabel = (item.objectLabel || item.object_label || '').toLowerCase().trim()
  if (subjectLabel === 'unknown' && predicateLabel === 'unknown' && objectLabel === 'unknown') return true
  return false
}

export function useAllClaims(page: number = 1) {
  return useQuery({
    queryKey: ['allClaims', page],
    queryFn: async () => {
      const response = await fetch(`/api/all-claims-holders?page=${page}`)
      if (!response.ok) throw new Error('Failed to fetch claims')
      const data = await response.json()
      const filteredClaims = (data.claims || []).filter((claim: any) => !isUnknownEntry(claim))
      return {
        claims: filteredClaims,
        pagination: data.pagination || { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      }
    },
    staleTime: 86400000, // 24 hours
  })
}

export function useTriples(page: number = 1) {
  return useQuery({
    queryKey: ['triples', page],
    queryFn: async () => {
      const response = await fetch(`/api/top-triples?page=${page}`)
      if (!response.ok) throw new Error('Failed to fetch triples')
      const data = await response.json()
      const filteredTriples = (data.triples || []).filter((triple: any) => !isUnknownEntry(triple))
      return {
        triples: filteredTriples,
        pagination: data.pagination || { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      }
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
      return (data.claims || []).filter((claim: any) => !isUnknownEntry(claim))
    },
    staleTime: 86400000, // 24 hours
  })
}

export function useAtoms(page: number = 1) {
  return useQuery({
    queryKey: ['atoms', page],
    queryFn: async () => {
      const response = await fetch(`/api/top-atoms?page=${page}`)
      if (!response.ok) throw new Error('Failed to fetch atoms')
      const data = await response.json()
      return {
        atoms: (data.atoms || []).filter((atom: any) => !isUnknownEntry(atom)).map((atom: any) => ({
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
        })),
        pagination: data.pagination || { page: 1, pageSize: 100, total: 0, totalPages: 0 },
      }
    },
    staleTime: 86400000, // 24 hours
  })
}
