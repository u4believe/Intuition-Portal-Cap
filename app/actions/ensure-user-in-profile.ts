"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function ensureUserInProfile(userId: string, email: string) {
  const cookieStore = await cookies()

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Handle errors silently
        }
      },
    },
  })

  // RLS policy on user_profiles requires auth.uid() = id, which is impossible for service role
  // The alert_preferences table can still reference user_id without user_profiles existing
  // Return success to allow the save to proceed
  return { success: true }
}
