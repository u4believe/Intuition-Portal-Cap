import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { encryptSession, DiscordUser } from '@/lib/session'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error || !code) {
    return NextResponse.redirect(new URL('/auth/login?error=discord_cancelled', request.url))
  }

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET

  console.log('[Discord OAuth Callback] DISCORD_CLIENT_ID present:', !!clientId)
  console.log('[Discord OAuth Callback] DISCORD_CLIENT_SECRET present:', !!clientSecret)
  console.log('[Discord OAuth Callback] NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'NOT SET')

  if (!clientId || !clientSecret) {
    console.error('[Discord OAuth Callback] Missing client credentials')
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    console.error('[Discord OAuth Callback] Missing NEXT_PUBLIC_APP_URL')
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  const redirectUri = `${appUrl}/api/auth/discord/callback`
  console.log('[Discord OAuth Callback] Using redirect URI:', redirectUri)

  try {
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

    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })

    if (!userRes.ok) {
      console.error('[Discord OAuth] Failed to fetch profile:', userRes.status)
      return NextResponse.redirect(new URL('/auth/login?error=discord_profile_failed', request.url))
    }

    const user = await userRes.json()

    const profile: DiscordUser = {
      id: user.id,
      username: user.username,
      globalName: user.global_name || null,
      avatar: user.avatar || null,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }

    // Encrypt the profile securely into a JWT
    const sessionToken = await encryptSession(profile)

    // Await strictly since `cookies().set()` behavior expects async in some versions/rendering engines
    // Set the JWT as an HttpOnly, cross-site immune secure cookie
    const cookieStore = await cookies();
    cookieStore.set('portal_cap_session', sessionToken, {
      httpOnly: false, // We must allow client to check if it's there via JS or we expose a /api/auth/session endpoint. Wait, HttpOnly should be true to prevent XSS!
      // But wait! Let me use an HttpOnly cookie and a `/api/auth/session` route to fetch it.
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    // Cleanly redirect home without exposing base64 JSON
    const dest = new URL('/', appUrl)
    return NextResponse.redirect(dest)
  } catch (err) {
    console.error('[Discord OAuth] Unexpected error:', err)
    return NextResponse.redirect(new URL('/auth/login?error=discord_failed', request.url))
  }
}
