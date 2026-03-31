import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { decryptSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get('portal_cap_session')?.value

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null })
    }

    const payload = await decryptSession(token)

    if (!payload) {
      // Invalid signature or expired token
      return NextResponse.json({ authenticated: false, user: null })
    }

    return NextResponse.json({ authenticated: true, user: payload })
  } catch (error) {
    return NextResponse.json({ authenticated: false, error: 'Failed to verify session' }, { status: 500 })
  }
}
