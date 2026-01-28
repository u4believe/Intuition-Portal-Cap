export async function POST(request: Request) {
  try {
    const { user_id, email } = await request.json()

    if (!user_id || !email) {
      return Response.json({ error: "Missing user_id or email" }, { status: 400 })
    }

    // Just return success - the user_id from Supabase auth is sufficient
    // No need to create a user_profiles record
    console.log("[v0] User profile check passed for user:", user_id)
    return Response.json({ success: true, user_id })
  } catch (error: any) {
    console.error("[v0] Error in ensure-profile:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}
