"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

interface AlertHistoryProps {
  userId: string
}

interface AlertRecord {
  id: string
  created_at: string
  alert_type: string
  predicate_label: string
  market_cap: number
  price_change: number
  status: "sent" | "pending" | "failed"
}

export default function AlertHistory({ userId }: AlertHistoryProps) {
  const [alerts, setAlerts] = useState<AlertRecord[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const { data, error } = await supabase
          .from("alert_history")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(50)

        if (error) throw error
        setAlerts(data || [])
      } catch (error) {
        console.error("Error fetching alerts:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [userId, supabase])

  if (loading) {
    return <div className="text-muted-foreground">Loading alert history...</div>
  }

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center py-8">No alerts yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <Card key={alert.id}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{alert.predicate_label}</h3>
                  <Badge
                    variant={
                      alert.status === "sent" ? "default" : alert.status === "pending" ? "secondary" : "destructive"
                    }
                  >
                    {alert.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {alert.alert_type === "price_change" && `Price change: ${alert.price_change}%`}
                  {alert.alert_type === "market_cap" && `Market cap: $${(alert.market_cap / 1e9).toFixed(2)}B`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(alert.created_at), "MMM dd, yyyy HH:mm")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
