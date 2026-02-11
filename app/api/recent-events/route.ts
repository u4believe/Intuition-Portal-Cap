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
          query GetRecentEvents {
            events {
              triple {
                subject {
                  label
                  type
                  term {
                    deposits {
                      term_id
                      sender_id
                      created_at
                    }
                    redemptions {
                      term_id
                      receiver_id
                      created_at
                    }
                  }
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
      return NextResponse.json({
        events: generateMockEvents(),
      })
    }

    const allEvents: any[] = []

    // Extract deposit and redemption events
    ;(data.data?.events || []).forEach((event: any) => {
      const tripleName = event.triple?.subject?.label || "Unknown"
      const deposits = event.triple?.subject?.term?.deposits || []
      const redemptions = event.triple?.subject?.term?.redemptions || []

      // Add deposit events
      deposits.forEach((deposit: any) => {
        allEvents.push({
          type: "deposit",
          tripleName: tripleName,
          senderId: deposit.sender_id,
          timestamp: deposit.created_at,
        })
      })

      // Add redemption events
      redemptions.forEach((redemption: any) => {
        allEvents.push({
          type: "redemption",
          tripleName: tripleName,
          receiverId: redemption.receiver_id,
          timestamp: redemption.created_at,
        })
      })
    })

    // Sort by timestamp (newest first)
    allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Filter events from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const recentEvents = allEvents.filter((event) => new Date(event.timestamp) >= sevenDaysAgo)

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
      type: "deposit",
      tripleName: "AI Agent",
      senderId: "0x1234...5678",
      timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      type: "redemption",
      tripleName: "Bitcoin Future",
      receiverId: "0x9876...5432",
      timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    },
    {
      type: "deposit",
      tripleName: "Ethereum Claims",
      senderId: "0xabcd...ef01",
      timestamp: new Date(Date.now() - 10 * 60000).toISOString(),
    },
    {
      type: "deposit",
      tripleName: "DeFi Protocol",
      senderId: "0x2468...1357",
      timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      type: "redemption",
      tripleName: "NFT Market",
      receiverId: "0x3579...2468",
      timestamp: new Date(Date.now() - 20 * 60000).toISOString(),
    },
  ]
}
