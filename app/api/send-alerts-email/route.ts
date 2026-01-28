import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
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

    // Get all pending alerts
    const { data: pendingAlerts, error: fetchError } = await supabase
      .from("alert_history")
      .select("*, alert_preferences(email, frequency)")
      .eq("status", "pending")

    if (fetchError) {
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
            return `${a.predicate_label}: ${a.price_change}% change`
          } else if (a.alert_type === "market_cap") {
            return `${a.predicate_label}: Market cap $${(a.market_cap / 1e9).toFixed(2)}B`
          } else if (a.alert_type === "position_update") {
            return `${a.predicate_label}: Position updated`
          }
          return `${a.predicate_label}: Alert triggered`
        })
        .join("\n")

      const emailResult = await resend.emails.send({
        from: "Signal App <noreply@resend.dev>",
        to: email,
        subject: `Signal App Alert - ${alerts.length} update${alerts.length > 1 ? "s" : ""}`,
        html: `
          <h2>Signal App Alert</h2>
          <p>You have ${alerts.length} new alert${alerts.length > 1 ? "s" : ""}:</p>
          <pre>${alertSummary}</pre>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/dashboard">View Dashboard</a></p>
        `,
      })

      if (emailResult.error) {
        console.error(`Error sending email to ${email}:`, emailResult.error)
      } else {
        sentAlerts.push(...alerts.map((a) => a.id))
      }
    }

    // Update alert statuses
    if (sentAlerts.length > 0) {
      const { error: updateError } = await supabase
        .from("alert_history")
        .update({ status: "sent" })
        .in("id", sentAlerts)

      if (updateError) {
        throw updateError
      }
    }

    return NextResponse.json({
      success: true,
      alertsSent: sentAlerts.length,
      emailsSent: alertsByEmail.size,
    })
  } catch (error: any) {
    console.error("Error in send-alerts-email:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
