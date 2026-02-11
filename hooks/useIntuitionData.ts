import { useQuery } from '@tanstack/react-query'
import {
  queryIntuitionGraphQL,
  DEPOSITS_QUERY,
  REDEMPTIONS_QUERY,
  ALL_CLAIMS_QUERY,
  TOP_CLAIMS_QUERY,
  TRIPLES_QUERY,
  ATOMS_QUERY,
  convertWeiToEther,
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
      const allEvents: LiveEvent[] = []

      try {
        // Fetch deposits
        const depositsData = await queryIntuitionGraphQL(DEPOSITS_QUERY)
        ;(depositsData?.deposits || []).forEach((deposit: any) => {
          allEvents.push({
            id: deposit.id,
            type: 'deposit',
            senderId: deposit.sender_id,
            assets: convertWeiToEther(deposit.assets_after_fees || 0),
            atomLabel: deposit.vault?.term?.atom?.label || 'Unknown',
            createdAt: deposit.created_at,
          })
        })

        // Fetch redemptions
        const redemptionsData = await queryIntuitionGraphQL(REDEMPTIONS_QUERY)
        ;(redemptionsData?.redemptions || []).forEach((redemption: any) => {
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
      const data = await queryIntuitionGraphQL(ALL_CLAIMS_QUERY, { limit })

      const claims: Claim[] = (data?.vaults || []).map((vault: any) => {
        const atom = vault.term?.atom
        const triple = vault.term?.triple
        const deposits = vault.deposits || []
        const redemptions = vault.redemptions || []
        const positions = vault.positions || []
        
        const marketCap = convertWeiToEther(vault.market_cap || 0)
        const totalShares = convertWeiToEther(vault.total_shares || 0)
        const currentSharePrice = convertWeiToEther(vault.current_share_price || 0)
        const totalAssets = convertWeiToEther(vault.total_assets || 0)
        const sharePriceChange24h = vault.share_price_change_stats_daily?.[0]?.difference 
          ? parseFloat(vault.share_price_change_stats_daily[0].difference)
          : 0

        return {
          termId: vault.term_id || vault.term?.id || '',
          label: atom?.label || 'Unknown',
          type: atom?.type || 'Unknown',
          image: atom?.image || null,
          subjectLabel: triple?.subject?.label || 'Unknown',
          subjectType: triple?.subject?.type || 'Unknown',
          predicateLabel: triple?.predicate?.label || 'Unknown',
          predicateType: triple?.predicate?.type || 'Unknown',
          objectLabel: triple?.object?.label || 'Unknown',
          objectType: triple?.object?.type || 'Unknown',
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

      return claims
    },
    refetchInterval: 86400000, // Refetch every 24 hours (daily)
  })
}

export function useTopClaims() {
  return useQuery({
    queryKey: ['topClaims'],
    queryFn: async () => {
      const data = await queryIntuitionGraphQL(TOP_CLAIMS_QUERY)

      const claims: Claim[] = (data?.triple_vaults || []).map((vault: any) => {
        const subject = vault.term?.triple?.subject
        const positions = subject?.positions || []
        const marketCap = convertWeiToEther(vault.market_cap || 0)
        const lastSharePrice = convertWeiToEther(
          vault.term?.share_price_change_stats_daily?.[0]?.last_share_price || 0
        )

        return {
          label: subject?.label || 'Unknown',
          image: subject?.image,
          marketCap: marketCap,
          positionCount: vault.position_count || 0,
          lastSharePrice: lastSharePrice,
          holders: positions.map((pos: any) => ({
            accountId: pos.account_id,
            shares: convertWeiToEther(pos.shares || 0),
          })),
        }
      })

      return claims
    },
    refetchInterval: 86400000, // Refetch every 24 hours (daily)
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
