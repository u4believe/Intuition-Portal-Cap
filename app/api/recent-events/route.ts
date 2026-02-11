import { NextResponse } from "next/server"
import { queryIntuitionGraphQL } from "@/lib/intuition-graphql"

export async function GET() {
  try {
    const DEPOSITS_QUERY = `
      query GetDeposits($limit: Int) {
        deposits(limit: $limit, order_by: {created_at: desc}) {
          id
          created_at
          assets_after_fees
          sender_id
          vault {
            term {
              atom {
                label
              }
            }
          }
        }
      }
    `

    const REDEMPTIONS_QUERY = `
      query GetRedemptions($limit: Int) {
        redemptions(limit: $limit, order_by: {created_at: desc}) {
          id
          created_at
          assets_for_receiver
          receiver_id
          vault {
            term {
              atom {
                label
              }
            }
          }
        }
      }
    `

    const allEvents: any[] = []

    try {
      const depositsData = await queryIntuitionGraphQL(DEPOSITS_QUERY, { limit: 50 })
      ;(depositsData?.deposits || []).forEach((deposit: any) => {
        const assets = deposit.assets_after_fees ? parseFloat(deposit.assets_after_fees) / 1e18 : 0
        allEvents.push({
          id: deposit.id,
          type: "deposit",
          atomLabel: deposit.vault?.term?.atom?.label || "Unknown",
          senderId: deposit.sender_id,
          assets: assets,
          createdAt: deposit.created_at,
        })
      })
    } catch (depositError) {
      console.warn("[v0] Error fetching deposits:", depositError)
    }

    try {
      const redemptionsData = await queryIntuitionGraphQL(REDEMPTIONS_QUERY, { limit: 50 })
      ;(redemptionsData?.redemptions || []).forEach((redemption: any) => {
        const assets = redemption.assets_for_receiver ? parseFloat(redemption.assets_for_receiver) / 1e18 : 0
        allEvents.push({
          id: redemption.id,
          type: "redemption",
          atomLabel: redemption.vault?.term?.atom?.label || "Unknown",
          receiverId: redemption.receiver_id,
          assets: assets,
          createdAt: redemption.created_at,
        })
      })
    } catch (redemptionError) {
      console.warn("[v0] Error fetching redemptions:", redemptionError)
    }

    // Sort by timestamp (newest first)
    allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Filter events from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentEvents = allEvents.filter((event) => new Date(event.createdAt) >= sevenDaysAgo)

    return NextResponse.json({ events: recentEvents })
  } catch (error) {
    console.error("[v0] Error fetching events:", error)
    return NextResponse.json({
      events: generateMockEvents(),
    })
  }
}

function generateMockEvents() {
  return [
    {
      id: "1",
      type: "deposit",
      atomLabel: "AI Agent",
      senderId: "0x1234...5678",
      assets: 1500.25,
      createdAt: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: "2",
      type: "redemption",
      atomLabel: "Blockchain Data",
      receiverId: "0xabcd...ef01",
      assets: 2300.75,
      createdAt: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      id: "3",
      type: "deposit",
      atomLabel: "Neural Networks",
      senderId: "0x5678...9012",
      assets: 800.5,
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
    },
    {
      id: "4",
      type: "redemption",
      atomLabel: "AI Agent",
      receiverId: "0x3456...7890",
      assets: 1200.0,
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    },
  ]
}
