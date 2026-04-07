export const INTUITION_GRAPHQL_URL = 'https://mainnet.intuition.sh/v1/graphql'

export async function queryIntuitionGraphQL(query: string, variables?: any) {
  try {
    const response = await fetch(INTUITION_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error('[intuition] GraphQL errors:', data.errors)
      throw new Error(data.errors[0]?.message || 'GraphQL error')
    }

    return data.data
  } catch (error) {
    console.error('[intuition] GraphQL fetch error:', error)
    throw error
  }
}

// Query for deposits (converted from subscription)
export const DEPOSITS_QUERY = `
  query GetDeposits {
    deposits(limit: 100, order_by: {created_at: desc}) {
      id
      sender_id
      assets_after_fees
      created_at
      vault {
        term {
          atom {
            label
          }
          triple {
            term_id
            subject {
              label
            }
            predicate {
              label
            }
            object {
              label
            }
          }
        }
      }
    }
  }
`

// Enriched query used by /api/trending — includes vault market_cap, position_count,
// price stats, and full term data needed for the 6-condition scoring algorithm.
export const TRENDING_DEPOSITS_QUERY = `
  query GetTrendingDeposits($since: timestamptz) {
    deposits(
      where: { created_at: { _gte: $since } }
      order_by: { created_at: desc }
      limit: 5000
    ) {
      id
      assets_after_fees
      created_at
      vault {
        term_id
        market_cap
        position_count
        share_price_change_stats_daily {
          first_share_price
          last_share_price
        }
        term {
          atom { label image type }
          triple {
            subject { label type }
            predicate { label type }
            object { label type }
          }
        }
      }
    }
  }
`

// Query for recent deposits for trending calculation
export const RECENT_DEPOSITS_QUERY = `
  query GetRecentDeposits($timestamp: timestamptz) {
    deposits(
      where: {created_at: {_gte: $timestamp}},
      limit: 1000
    ) {
      id
      assets_after_fees
      vault {
        term_id
      }
      sender_id
    }
  }
`

// Query for redemptions (converted from subscription)
export const REDEMPTIONS_QUERY = `
  query GetRedemptions {
    redemptions(limit: 100, order_by: {created_at: desc}) {
      id
      receiver_id
      assets
      created_at
      vault {
        term {
          atom {
            label
          }
          triple {
            term_id
            subject {
              label
            }
            predicate {
              label
            }
            object {
              label
            }
          }
        }
      }
    }
  }
`

// Query for all vaults with complete information
export const ALL_CLAIMS_QUERY = `
  query GetVaults($limit: Int) {
    vaults(limit: $limit, order_by: {market_cap: desc}) {
      term_id
      market_cap
      total_shares
      current_share_price
      total_assets
      position_count
      term {
        atom {
          label
          image
          type
        }
        triple {
          subject {
            label
            type
          }
          predicate {
            label
            type
          }
          object {
            label
            type
          }
          creator_id
        }
      }
      share_price_change_stats_daily {
        difference
        first_share_price
        last_share_price
        change_count
      }
      deposits {
        id
        created_at
        shares
      }
      redemptions {
        id
        created_at
        shares
      }
      positions {
        account_id
        shares
        total_deposit_assets_after_total_fees
        total_redeem_assets_for_receiver
      }
    }
  }
`

// Query for top claims by market cap
export const TOP_CLAIMS_QUERY = `
  query GetTopClaims {
    triple_vaults(limit: 10, order_by: [{market_cap: desc}]) {
      market_cap
      position_count
      term {
        total_market_cap
        triple {
          subject {
            label
            image
          }
        }
        share_price_change_stats_daily {
          last_share_price
        }
      }
    }
  }
`

// Query for triples with vault information
export const TRIPLES_QUERY = `
  query GetTriples($limit: Int) {
    vaults(limit: $limit, order_by: {market_cap: desc}) {
      market_cap
      position_count
      total_assets
      total_shares
      current_share_price
      term {
        triple {
          subject {
            label
            image
          }
          predicate {
            label
          }
          object {
            label
          }
        }
        positions {
          account_id
          shares
          total_deposit_assets_after_total_fees
          total_redeem_assets_for_receiver
        }
        share_price_change_stats_daily {
          difference
          first_share_price
          last_share_price
          change_count
        }
      }
    }
  }
`

// Query for atoms with vault information
export const ATOMS_QUERY = `
  query GetAtoms($limit: Int) {
    vaults(limit: $limit, order_by: {market_cap: desc}) {
      market_cap
      position_count
      total_shares
      total_assets
      current_share_price
      term {
        atom {
          label
          image
          positions {
            account_id
            shares
            total_deposit_assets_after_total_fees
            total_redeem_assets_for_receiver
          }
        }
        share_price_change_stats_daily {
          difference
          first_share_price
          last_share_price
          change_count
        }
      }
    }
  }
`

export function convertWeiToEther(wei: string | number): number {
  try {
    const weiNum = typeof wei === 'string' ? BigInt(wei) : BigInt(wei)
    return Number(weiNum) / 1e18
  } catch {
    return 0
  }
}
