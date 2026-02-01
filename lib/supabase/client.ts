import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !anonKey) {
      console.error("[v0] Missing Supabase environment variables")
      throw new Error("Supabase URL and Anon Key are required")
    }

    supabaseClient = createBrowserClient(url, anonKey)
  }
  return supabaseClient
}
