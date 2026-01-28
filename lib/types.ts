export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface AlertTriggerType {
  id: string
  label: string
  description: string
  metric_type: "price_change" | "market_cap" | "position_count"
}

export interface AlertPreference {
  id: string
  user_id: string
  predicate_id: string
  predicate_name: string
  email: string
  alert_frequency: "realtime" | "hourly" | "daily" | "weekly"
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AlertTrigger {
  id: string
  preference_id: string
  trigger_type_id: string
  threshold_value: number | null
  threshold_type: "percentage" | "absolute" | null
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export interface AlertHistory {
  id: string
  user_id: string
  preference_id: string | null
  trigger_type: string
  data: Record<string, unknown>
  email_sent_at: string | null
  created_at: string
}

export interface EmailLog {
  id: string
  user_id: string
  recipient_email: string
  subject: string
  status: "pending" | "sent" | "failed" | "bounced"
  error_message: string | null
  created_at: string
  sent_at: string | null
}

export interface IntuitionPredicateData {
  predicate: {
    label: string
    image: string
    term: {
      share_price_change_stats_hourly: Array<{
        bucket: string
        difference: number
        last_share_price: number
        term: {
          positions: Array<{
            created_at: string
          }>
          total_market_cap: number
          total_assets: number
        }
      }>
    }
  }
  total_market_cap: number
  total_position_count: number
}
