import { NextResponse } from "next/server"

export async function GET() {
  try {
    const response = await fetch("https://mainnet.intuition.sh/v1/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query GetAllClaimsWithHolders {
            triple_vaults(limit: 100, order_by: [{market_cap: desc}]) {
              market_cap
              position_count
              term {
                total_market_cap
                triple {
                  subject {
                    label
                    image
                    positions {
                      account_id
                      shares
                    }
                  }
                }
                share_price_change_stats_daily {
                  last_share_price
                }
              }
            }
          }
        `,
      }),
    })

    const data = await response.json()

    if (data.errors) {
      console.error("[v0] GraphQL errors:", data.errors)
      return NextResponse.json({ claims: [] })
    }

    const claims = (data.data?.triple_vaults || []).map((vault: any) => {
      const subject = vault.term?.triple?.subject
      const positions = subject?.positions || []
      const marketCap = convertWeiToEther(vault.market_cap || 0)
      const lastSharePrice = convertWeiToEther(vault.term?.share_price_change_stats_daily?.[0]?.last_share_price || 0)

      return {
        label: subject?.label || "Unknown",
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

    return NextResponse.json({ claims })
  } catch (error) {
    console.error("[v0] Error fetching claims:", error)
    return NextResponse.json({ claims: [] })
  }
}

function convertWeiToEther(wei: string | number): number {
  try {
    const weiNum = typeof wei === "string" ? BigInt(wei) : BigInt(wei)
    return Number(weiNum) / 1e18
  } catch {
    return 0
  }
}
