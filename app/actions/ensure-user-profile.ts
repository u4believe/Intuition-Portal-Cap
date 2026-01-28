"use server"

import { getSupabaseServiceRole } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function ensureUserProfileExists() {
  const supabase = await getSupabaseServiceRole()

  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    redirect("/auth/login")
  }

  // Return the authenticated user ID
  return authData.user.id
}
