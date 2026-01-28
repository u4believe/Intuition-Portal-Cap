import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const GRAPHQL_ENDPOINT = "https://mainnet.intuition.sh/v1/graphql"

const PREDICATE_QUERY = `
subscription Predicate($limit: Int, $orderBy: [share_price_change_stats_hourly_order_by!]) {
  subject_predicates {
    predicate {
      label
      image
      term {
        share_price_change_stats_hourly(limit: $limit, order_by: $orderBy) {
          bucket
          difference
          last_share_price
          term {
            positions {
              created_at
            }
            total_market_cap
            total_assets
          }
        }
      }
    }
    total_market_cap
    total_position_count
  }
}
`

async function fetchIntuitionData() {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: PREDICATE_QUERY,
        variables: {
          limit: 2,
          orderBy: [{ bucket: "desc" }],
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching Intuition data:", error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            } catch {}
          },
        },
      },
    )

    // Fetch data from Intuition
    const intuitionData = await fetchIntuitionData()

    if (intuitionData.errors) {
      return NextResponse.json(
        { error: "Failed to fetch Intuition data", details: intuitionData.errors },
        { status: 500 },
      )
    }

    // Get all enabled alert preferences
    const { data: preferences, error: prefError } = await supabase
      .from("alert_preferences")
      .select("id, user_id, email, frequency, price_change_threshold, market_cap_change, position_updates")
      .eq("enabled", true)

    if (prefError) {
      throw prefError
    }

    // Process alerts for each user preference
    const predicates = intuitionData.data?.subject_predicates || []
    const alerts: any[] = []

    for (const predicate of predicates) {
      const priceChanges = predicate.predicate?.term?.share_price_change_stats_hourly || []

      for (const preference of preferences || []) {
        const matchingAlerts: any[] = []

        // Check price changes
        for (const change of priceChanges) {
          const priceDifference = Math.abs(change.difference || 0)
          if (preference.price_change_threshold && priceDifference >= preference.price_change_threshold) {
            matchingAlerts.push({
              type: "price_change",
              data: change,
              predicate: predicate.predicate,
            })
          }
        }

        // Check market cap changes
        if (preference.market_cap_change && predicate.total_market_cap) {
          matchingAlerts.push({
            type: "market_cap",
            data: { market_cap: predicate.total_market_cap },
            predicate: predicate.predicate,
          })
        }

        // Check position updates
        if (preference.position_updates && predicate.total_position_count) {
          matchingAlerts.push({
            type: "position_update",
            data: { position_count: predicate.total_position_count },
            predicate: predicate.predicate,
          })
        }

        // Store alerts in database
        for (const alert of matchingAlerts) {
          alerts.push({
            user_id: preference.user_id,
            preference_id: preference.id,
            alert_type: alert.type,
            predicate_label: alert.predicate?.label,
            market_cap: alert.data.market_cap || predicate.total_market_cap,
            price_change: alert.data.difference || 0,
            status: "pending",
          })
        }
      }
    }

    // Store alerts in database
    if (alerts.length > 0) {
      const { error: insertError } = await supabase.from("alert_history").insert(alerts)

      if (insertError) {
        throw insertError
      }
    }

    return NextResponse.json({
      success: true,
      alertsProcessed: alerts.length,
      alertDetails: alerts,
    })
  } catch (error: any) {
    console.error("Error in fetch-intuition-signals:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
