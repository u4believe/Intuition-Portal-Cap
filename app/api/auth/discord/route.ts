import { NextRequest, NextResponse } from 'next/server'

function getBaseUrl(request: NextRequest): string {
  // 1. Explicit env override — most reliable, set this to your deployed URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // 2. Forwarded host from Replit/proxy reverse proxy
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  if (host) return `${proto}://${host}`
  // 3. REPLIT_DOMAINS env var (contains the public domain in both dev and prod)
  const replitDomains = process.env.REPLIT_DOMAINS
  if (replitDomains) {
    return `https://${replitDomains.split(',')[0].trim()}`
  }
  return new URL(request.url).origin
}

export async function GET(request: NextRequest) {
  const clientId = process.env.DISCORD_CLIENT_ID

  if (!clientId) {
    return NextResponse.redirect(new URL('/auth/login?error=discord_not_configured', request.url))
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/discord/callback`
  console.log('[Discord OAuth] Using redirect URI:', redirectUri)

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
  })

  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params}`)
}
