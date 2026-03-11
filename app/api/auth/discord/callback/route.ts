import { NextRequest, NextResponse } from 'next/server'

function getBaseUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  const replitDomains = process.env.REPLIT_DOMAINS
  if (replitDomains) {
    return `https://${replitDomains.split(',')[0].trim()}`
  }
  return new URL(request.url).origin
}

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

  const baseUrl = getBaseUrl(request)
  const redirectUri = `${baseUrl}/api/auth/discord/callback`
  console.log('[Discord OAuth] Callback using redirect URI:', redirectUri)

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

    const profile = {
      id: user.id,
      username: user.username,
      globalName: user.global_name || null,
      avatar: user.avatar || null,
      authenticatedAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    }

    const encodedProfile = Buffer.from(JSON.stringify(profile)).toString('base64url')
    const dest = new URL('/', baseUrl)
    dest.searchParams.set('discord_auth', encodedProfile)

    return NextResponse.redirect(dest)
  } catch (err) {
    console.error('[Discord OAuth] Unexpected error:', err)
    return NextResponse.redirect(new URL('/auth/login?error=discord_failed', request.url))
  }
}
