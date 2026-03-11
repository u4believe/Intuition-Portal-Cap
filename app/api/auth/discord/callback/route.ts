import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/auth/login?error=discord_cancelled', request.url))
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
  const redirectUri = `${baseUrl}/api/auth/discord/callback`

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text()
      console.error('[Discord OAuth] Token exchange failed:', tokenRes.status, text)
      return NextResponse.redirect(new URL('/auth/login?error=discord_token_failed', request.url))
    }

    const tokenData = await tokenRes.json()

    // Get Discord user profile
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      console.error('[Discord OAuth] Failed to fetch profile:', userRes.status)
      return NextResponse.redirect(new URL('/auth/login?error=discord_profile_failed', request.url))
    }

    const user = await userRes.json()

    // Build a minimal profile — no access token stored in the redirect
    const profile = {
      id: user.id,
      username: user.username,
      globalName: user.global_name || null,
      avatar: user.avatar || null,
      authenticatedAt: Date.now(),
      // 7-day session
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }

    // Pass profile to client via query param (base64 encoded)
    // We omit the access token — we only need identity data
    const encodedProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const dest = new URL('/', request.url)
    dest.searchParams.set('discord_auth', encodedProfile)

    return NextResponse.redirect(dest)
  } catch (err) {
    console.error('[Discord OAuth] Unexpected error:', err)
    return NextResponse.redirect(new URL('/auth/login?error=discord_failed', request.url))
  }
}
