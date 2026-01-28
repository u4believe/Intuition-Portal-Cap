"use client"

import { useState, useEffect } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, CheckCircle } from "lucide-react"
import SetupGuide from "./setup-guide"
import TripleAtomSelector from "./triple-atom-selector"
// import { ensureUserInProfile } from "@/app/actions/ensure-user-in-profile"

interface AlertPreferencesProps {
  userId: string
}

interface AlertPreference {
  id: string
  email: string
  alert_frequency: "realtime" | "hourly" | "daily" | "weekly"
  predicate_name: string
  is_enabled: boolean
}

interface AlertTrigger {
  id: string
  trigger_type_id: string
  threshold_value: number | null
  threshold_type: string | null
  is_enabled: boolean
}

interface TriggerType {
  id: string
  label: string
  metric_type: string
}

export default function AlertPreferences({ userId }: AlertPreferencesProps) {
  const [preferences, setPreferences] = useState<AlertPreference | null>(null)
  const [triggers, setTriggers] = useState<AlertTrigger[]>([])
  const [triggerTypes, setTriggerTypes] = useState<TriggerType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [tablesNotFound, setTablesNotFound] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    predicate_name: "",
    alert_frequency: "daily" as const,
    is_enabled: true,
  })
  const [selectedTriggers, setSelectedTriggers] = useState<Record<string, boolean>>({})

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    async function fetchData() {
      try {
        console.log("[v0] Fetching trigger types and preferences for user:", userId)

        const { data: triggerTypesData, error: typesError } = await supabase.from("alert_trigger_types").select("*")

        if (typesError?.code === "PGRST116" || typesError?.message?.includes("schema cache")) {
          console.log("[v0] Tables not found - need to run database setup")
          setTablesNotFound(true)
          setLoading(false)
          return
        }

        if (typesError) {
          console.log("[v0] Trigger types error:", typesError)
          throw typesError
        }

        console.log("[v0] Trigger types fetched:", triggerTypesData)
        setTriggerTypes(triggerTypesData || [])

        const { data: preferencesData, error: prefError } = await supabase
          .from("alert_preferences")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle()

        if (prefError && prefError.code !== "PGRST116") {
          console.log("[v0] Preferences error:", prefError)
          throw prefError
        }

        if (preferencesData) {
          console.log("[v0] Existing preferences found:", preferencesData)
          setPreferences(preferencesData)
          setFormData({
            email: preferencesData.email,
            predicate_name: preferencesData.predicate_name || "",
            alert_frequency: preferencesData.alert_frequency,
            is_enabled: preferencesData.is_enabled,
          })

          const { data: triggersData, error: triggersError } = await supabase
            .from("alert_triggers")
            .select("*")
            .eq("preference_id", preferencesData.id)

          if (triggersError) {
            console.log("[v0] Triggers error:", triggersError)
            throw triggersError
          }

          const triggersMap: Record<string, boolean> = {}
          triggersData?.forEach((trigger) => {
            triggersMap[trigger.trigger_type_id] = trigger.is_enabled
          })
          setTriggers(triggersData || [])
          setSelectedTriggers(triggersMap)
        } else {
          console.log("[v0] No existing preferences, getting user email")
          const { data: authData } = await supabase.auth.getUser()
          if (authData.user?.email) {
            setFormData((prev) => ({ ...prev, email: authData.user!.email! }))
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching data:", error)
        setMessage("Error loading preferences. Make sure database tables are created.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [userId, supabase])

  async function handleSave() {
    setSaving(true)
    setMessage("")

    try {
      console.log("[v0] Saving preferences for user ID:", userId)

      // The database will handle the foreign key or allow direct inserts

      if (preferences?.id) {
        console.log("[v0] Updating existing preferences")

        const { error } = await supabase
          .from("alert_preferences")
          .update({
            email: formData.email,
            predicate_name: formData.predicate_name,
            alert_frequency: formData.alert_frequency,
            is_enabled: formData.is_enabled,
          })
          .eq("id", preferences.id)

        if (error) throw error

        for (const triggerType of triggerTypes) {
          const existingTrigger = triggers.find((t) => t.trigger_type_id === triggerType.id)
          const isEnabled = selectedTriggers[triggerType.id] || false

          if (existingTrigger) {
            const { error: updateError } = await supabase
              .from("alert_triggers")
              .update({ is_enabled: isEnabled })
              .eq("id", existingTrigger.id)

            if (updateError) throw updateError
          } else {
            const { error: insertError } = await supabase.from("alert_triggers").insert([
              {
                preference_id: preferences.id,
                trigger_type_id: triggerType.id,
                is_enabled: isEnabled,
              },
            ])

            if (insertError) throw insertError
          }
        }
      } else {
        console.log("[v0] Creating new preference with user ID:", userId)

        const predicateId = formData.predicate_name || `predicate-${Date.now()}`

        const { data: newPref, error: prefError } = await supabase
          .from("alert_preferences")
          .insert([
            {
              user_id: userId,
              email: formData.email,
              predicate_name: formData.predicate_name,
              predicate_id: predicateId,
              alert_frequency: formData.alert_frequency,
              is_enabled: formData.is_enabled,
            },
          ])
          .select()
          .single()

        if (prefError) throw prefError

        console.log("[v0] New preference created:", newPref)
        setPreferences(newPref)

        const triggersToCreate = triggerTypes.map((type) => ({
          preference_id: newPref.id,
          trigger_type_id: type.id,
          is_enabled: selectedTriggers[type.id] || false,
        }))

        const { error: triggersError } = await supabase.from("alert_triggers").insert(triggersToCreate)

        if (triggersError) throw triggersError
      }

      console.log("[v0] Preferences saved successfully")
      setMessage("Preferences saved successfully!")
      setTimeout(() => setMessage(""), 3000)
    } catch (error: any) {
      console.error("[v0] Save error:", error)
      setMessage(`Error: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading preferences...</div>
  }

  if (tablesNotFound) {
    return <SetupGuide />
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Alert Configuration</CardTitle>
          <CardDescription>Manage how you receive alerts from the Intuition Portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email Display */}
          <div>
            <Label>Email Address</Label>
            <p className="text-sm text-muted-foreground mt-1">{formData.email}</p>
          </div>

          {/* Predicate Name */}
          <div>
            <Label htmlFor="predicate">Predicate Name</Label>
            <Input
              id="predicate"
              value={formData.predicate_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, predicate_name: e.target.value }))}
              placeholder="e.g., AI Market Cap"
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-2">Identifier for this alert configuration</p>
          </div>

          {/* Alert Frequency */}
          <div>
            <Label htmlFor="frequency">Alert Frequency</Label>
            <Select
              value={formData.alert_frequency}
              onValueChange={(value: any) => setFormData((prev) => ({ ...prev, alert_frequency: value }))}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="realtime">Real-time</SelectItem>
                <SelectItem value="hourly">Hourly Digest</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">How often you want to receive grouped alerts</p>
          </div>

          {/* Alert Triggers */}
          <div className="space-y-3 pt-4 border-t">
            <Label>Alert Triggers</Label>
            <p className="text-xs text-muted-foreground">Select what should trigger an email alert</p>

            {triggerTypes.map((type) => (
              <div key={type.id} className="flex items-center space-x-2">
                <Checkbox
                  id={type.id}
                  checked={selectedTriggers[type.id] || false}
                  onCheckedChange={(checked) =>
                    setSelectedTriggers((prev) => ({ ...prev, [type.id]: checked as boolean }))
                  }
                />
                <Label htmlFor={type.id} className="font-normal cursor-pointer">
                  <div>
                    <p className="font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">{type.metric_type}</p>
                  </div>
                </Label>
              </div>
            ))}
          </div>

          {/* Enable/Disable */}
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, is_enabled: checked as boolean }))}
            />
            <Label htmlFor="enabled" className="font-normal cursor-pointer">
              Enable alerts
            </Label>
          </div>

          {/* Status Message */}
          {message && (
            <div
              className={`p-3 rounded-md text-sm flex items-center gap-2 ${
                message.includes("Error")
                  ? "bg-destructive/10 text-destructive"
                  : "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-200"
              }`}
            >
              {message.includes("Error") ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              {message}
            </div>
          )}

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : "Save Preferences"}
          </Button>
        </CardContent>
      </Card>

      {/* TripleAtomSelector Component */}
      <TripleAtomSelector userId={userId} preferences={preferences} />
    </div>
  )
}
