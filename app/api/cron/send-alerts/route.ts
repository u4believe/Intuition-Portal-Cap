import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    })

    // Get all pending alerts
    const { data: pendingAlerts, error: fetchError } = await supabase
      .from("alert_history")
      .select("*, alert_preferences(email, frequency)")
      .eq("status", "pending")

    if (fetchError) {
      console.error("[v0] Error fetching pending alerts:", fetchError)
      throw fetchError
    }

    // Group alerts by user and email
    const alertsByEmail: Map<string, any[]> = new Map()

    for (const alert of pendingAlerts || []) {
      const email = alert.alert_preferences?.email
      if (email) {
        if (!alertsByEmail.has(email)) {
          alertsByEmail.set(email, [])
        }
        alertsByEmail.get(email)!.push(alert)
      }
    }

    // Send emails
    const sentAlerts: string[] = []
    for (const [email, alerts] of alertsByEmail) {
      const alertSummary = alerts
        .map((a) => {
          if (a.alert_type === "price_change") {
            return `• ${a.predicate_label}: ${a.price_change}% change`
          } else if (a.alert_type === "market_cap") {
            return `• ${a.predicate_label}: Market cap $${(a.market_cap / 1e9).toFixed(2)}B`
          } else if (a.alert_type === "position_update") {
            return `• ${a.predicate_label}: Position updated`
          }
          return `• ${a.predicate_label}: Alert triggered`
        })
        .join("\n")

      try {
        const emailResult = await resend.emails.send({
          from: "Signal App <noreply@resend.dev>",
          to: email,
          subject: `Signal App Alert - ${alerts.length} update${alerts.length > 1 ? "s" : ""}`,
          html: `
            <h2>Signal App Alert</h2>
            <p>You have ${alerts.length} new alert${alerts.length > 1 ? "s" : ""} from the Intuition Portal:</p>
            <pre style="background: #f5f5f5; padding: 12px; border-radius: 4px; overflow: auto;">${alertSummary}</pre>
            <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard" style="color: #0066cc; text-decoration: none;">View Dashboard</a></p>
          `,
        })

        if (emailResult.error) {
          console.error(`[v0] Error sending email to ${email}:`, emailResult.error)
        } else {
          console.log(`[v0] Email sent to ${email}`)
          sentAlerts.push(...alerts.map((a) => a.id))
        }
      } catch (emailError) {
        console.error(`[v0] Exception sending email to ${email}:`, emailError)
      }
    }

    // Update alert statuses
    if (sentAlerts.length > 0) {
      const { error: updateError } = await supabase
        .from("alert_history")
        .update({ status: "sent" })
        .in("id", sentAlerts)

      if (updateError) {
        console.error("[v0] Error updating alert status:", updateError)
        throw updateError
      }
    }

    console.log("[v0] Cron job completed. Sent", sentAlerts.length, "alerts")
    return NextResponse.json({
      success: true,
      alertsSent: sentAlerts.length,
      emailsSent: alertsByEmail.size,
    })
  } catch (error: any) {
    console.error("[v0] Error in send-alerts cron:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

export const dynamic = "force-dynamic"
