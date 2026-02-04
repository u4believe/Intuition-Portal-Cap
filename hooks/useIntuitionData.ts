import { useQuery } from '@tanstack/react-query'
import {
  DEPOSITS_QUERY,
  REDEMPTIONS_QUERY,
  ALL_CLAIMS_QUERY,
  TOP_CLAIMS_QUERY,
  TRIPLES_QUERY,
  ATOMS_QUERY,
  convertWeiToEther,
  queryIntuitionGraphQL,
} from '@/lib/intuition-graphql'

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
  emoji: string | null
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
    staleTime: 30000,
  })
}

export function useLiveEvents() {
  return useQuery({
    queryKey: ['liveEvents'],
    queryFn: async () => {
      const allEvents: LiveEvent[] = []
      let depositsResponse, redemptionsResponse

      try {
        depositsResponse = await queryIntuitionGraphQL(DEPOSITS_QUERY)
        redemptionsResponse = await queryIntuitionGraphQL(REDEMPTIONS_QUERY)

        (depositsResponse?.deposits || []).forEach((deposit: any) => {
          allEvents.push({
            id: deposit.id,
            type: 'deposit',
            senderId: deposit.sender_id,
            assets: convertWeiToEther(deposit.assets || 0),
            atomLabel: deposit.vault?.term?.atom?.label || 'Unknown',
            createdAt: deposit.created_at,
          })
        })

        (redemptionsResponse?.redemptions || []).forEach((redemption: any) => {
          allEvents.push({
            id: redemption.id,
            type: 'redemption',
            receiverId: redemption.receiver_id,
            assets: convertWeiToEther(redemption.assets || 0),
            atomLabel: redemption.vault?.term?.atom?.label || 'Unknown',
            createdAt: redemption.created_at,
          })
        })
      } catch (error) {
        console.error('[v0] Error fetching live events:', error)
      }

      // Sort by timestamp (newest first)
      allEvents.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )

      return allEvents
    },
    refetchInterval: 10000, // Refetch every 10 seconds for live updates
  })
}

export function useAllClaims(limit: number = 1000) {
  return useQuery({
    queryKey: ['allClaims', limit],
    queryFn: async () => {
      const response = await fetch(`/api/all-claims?limit=${limit}`)
      if (!response.ok) throw new Error('Failed to fetch claims')
      const data = await response.json()
      return data.claims || []
    },
    staleTime: 86400000,
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
    staleTime: 86400000,
  })
}

export function useTriples(limit: number = 1000) {
  return useQuery({
    queryKey: ['triples', limit],
    queryFn: async () => {
      const data = await queryIntuitionGraphQL(TRIPLES_QUERY, { limit })

      const triples: Claim[] = (data?.triples || []).map((triple: any) => {
        const subject = triple.subject
        const predicate = triple.predicate
        const object = triple.object
        const vault = triple.term?.vaults?.[0] || {}
        const deposits = vault.deposits || []
        const redemptions = vault.redemptions || []
        const positions = vault.positions || []
        
        const marketCap = convertWeiToEther(vault.market_cap || 0)
        const totalShares = convertWeiToEther(vault.total_shares || 0)
        const currentSharePrice = totalShares > 0 ? marketCap / totalShares : 0
        const totalAssets = convertWeiToEther(vault.total_assets || 0)
        const sharePriceChange24h = vault.share_price_change_stats_daily?.[0]?.difference 
          ? parseFloat(vault.share_price_change_stats_daily[0].difference)
          : 0

        return {
          termId: triple.term_id || '',
          label: `${subject?.label} - ${predicate?.label} - ${object?.label}`,
          type: triple.term?.type || 'Unknown',
          image: subject?.image || null,
          subjectLabel: subject?.label || 'Unknown',
          subjectType: subject?.type || 'Unknown',
          predicateLabel: predicate?.label || 'Unknown',
          predicateType: predicate?.type || 'Unknown',
          objectLabel: object?.label || 'Unknown',
          objectType: object?.type || 'Unknown',
          marketCap: marketCap,
          totalShares: totalShares,
          currentSharePrice: currentSharePrice,
          totalAssets: totalAssets,
          positionCount: vault.position_count || 0,
          sharePriceChange24h: sharePriceChange24h,
          deposits: deposits.map((dep: any) => ({
            id: dep.id,
            createdAt: dep.created_at,
            shares: convertWeiToEther(dep.shares || 0),
          })),
          redemptions: redemptions.map((red: any) => ({
            id: red.id,
            createdAt: red.created_at,
            shares: convertWeiToEther(red.shares || 0),
          })),
          positions: positions.map((pos: any) => ({
            accountId: pos.account_id,
            shares: convertWeiToEther(pos.shares || 0),
            totalDepositAssetsAfterTotalFees: convertWeiToEther(pos.total_deposit_assets_after_total_fees || 0),
            totalRedeemAssetsForReceiver: convertWeiToEther(pos.total_redeem_assets_for_receiver || 0),
          })),
        }
      })

      return triples
    },
    refetchInterval: 86400000, // Refetch every 24 hours (daily)
  })
}

export function useAtoms(limit: number = 1000) {
  return useQuery({
    queryKey: ['atoms', limit],
    queryFn: async () => {
      const data = await queryIntuitionGraphQL(ATOMS_QUERY, { limit })

      const atoms: Claim[] = (data?.atoms || []).map((atom: any) => {
        const vault = atom.term?.vaults?.[0] || {}
        const deposits = vault.deposits || []
        const redemptions = vault.redemptions || []
        const positions = vault.positions || []
        
        const marketCap = convertWeiToEther(vault.market_cap || 0)
        const totalShares = convertWeiToEther(vault.total_shares || 0)
        const currentSharePrice = totalShares > 0 ? marketCap / totalShares : 0
        const totalAssets = convertWeiToEther(vault.total_assets || 0)
        const sharePriceChange24h = vault.share_price_change_stats_daily?.[0]?.difference 
          ? parseFloat(vault.share_price_change_stats_daily[0].difference)
          : 0

        return {
          termId: atom.term_id || '',
          label: atom.label || 'Unknown',
          type: atom.type || 'Unknown',
          image: atom.image || null,
          emoji: atom.emoji || null,
          createdAt: atom.created_at,
          creatorLabel: atom.creator?.label || 'Unknown',
          creatorImage: atom.creator?.image || null,
          marketCap: marketCap,
          totalShares: totalShares,
          currentSharePrice: currentSharePrice,
          totalAssets: totalAssets,
          positionCount: vault.position_count || 0,
          sharePriceChange24h: sharePriceChange24h,
          deposits: deposits.map((dep: any) => ({
            id: dep.id,
            createdAt: dep.created_at,
            shares: convertWeiToEther(dep.shares || 0),
          })),
          redemptions: redemptions.map((red: any) => ({
            id: red.id,
            createdAt: red.created_at,
            shares: convertWeiToEther(red.shares || 0),
          })),
          positions: positions.map((pos: any) => ({
            accountId: pos.account_id,
            shares: convertWeiToEther(pos.shares || 0),
            totalDepositAssetsAfterTotalFees: convertWeiToEther(pos.total_deposit_assets_after_total_fees || 0),
            totalRedeemAssetsForReceiver: convertWeiToEther(pos.total_redeem_assets_for_receiver || 0),
          })),
        }
      })

      return atoms
    },
    refetchInterval: 86400000, // Refetch every 24 hours (daily)
  })
}
