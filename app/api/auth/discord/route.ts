import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID

  // Debug: log all relevant env vars (safe — client ID prefix only)
  console.log('[Discord OAuth] DISCORD_CLIENT_ID present:', !!clientId)
  console.log('[Discord OAuth] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'NOT SET')

  if (!clientId) {
    console.error('[Discord OAuth] Missing DISCORD_CLIENT_ID — check Vercel environment variables')
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  // Use NEXT_PUBLIC_APP_URL — must be set in Vercel env vars
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[Discord OAuth] Missing NEXT_PUBLIC_APP_URL — check Vercel environment variables')
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  const redirectUri = `${appUrl}/api/auth/discord/callback`
  console.log('[Discord OAuth] Using redirect URI:', redirectUri)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
  })

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
}
