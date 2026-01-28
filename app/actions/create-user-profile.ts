"use server"

export async function createUserProfile(userId: string, email: string) {
  try {
    console.log("[v0] User authenticated with ID:", userId, "Email:", email)
    // No need to create user_profiles - auth.users already exists
    // alert_preferences will reference auth.users(id) directly via foreign key
    return { success: true }
  } catch (error) {
    console.log("[v0] Error:", error)
    throw error
  }
}
