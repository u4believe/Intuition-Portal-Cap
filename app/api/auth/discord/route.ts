import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  // Build the redirect URI from the actual request origin so it works in both dev and prod
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const redirectUri = `${baseUrl}/api/auth/discord/callback`

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
  })

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
}
