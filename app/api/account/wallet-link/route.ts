import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { isAddress, verifyMessage } from 'viem'
import { decryptSession } from '@/lib/session'
import { buildLinkMessage, LINK_MESSAGE_MAX_AGE_MS } from '@/lib/account/link-message'
import { getLinkedWallet, linkWallet, unlinkWallet } from '@/lib/account/wallet-links'

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status })
}

/** Linking is for accounts that signed in with Discord; wallet sign-ins already are a wallet. */
async function discordAccount(): Promise<{ discordId: string; ref: string } | null> {
  const token = (await cookies()).get('portal_cap_session')?.value
  if (!token) return null
  const session = await decryptSession(token)
  if (!session?.id || (session.expiresAt && session.expiresAt <= Date.now())) return null
  const discordId = String(session.id)
  return { discordId, ref: `discord:${discordId}` }
}

// GET: the wallet linked to the signed-in Discord account
export async function GET() {
  const account = await discordAccount()
  if (!account) return jsonError(401, 'unauthenticated', 'Sign in with Discord to link a wallet.')
  return NextResponse.json(
    { discordId: account.discordId, linkedWallet: await getLinkedWallet(account.ref) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

// POST: link a wallet — proven by a signature over the link message
export async function POST(req: NextRequest) {
  const account = await discordAccount()
  if (!account) return jsonError(401, 'unauthenticated', 'Sign in with Discord to link a wallet.')

  const body = await req.json().catch(() => null)
  const { address, signature, timestamp } = body ?? {}
  if (typeof address !== 'string' || !isAddress(address) || typeof signature !== 'string' || typeof timestamp !== 'number') {
    return jsonError(400, 'invalid_request', 'Missing wallet address, signature or timestamp.')
  }
  const age = Date.now() - timestamp
  if (age < -60_000 || age > LINK_MESSAGE_MAX_AGE_MS) {
    return jsonError(400, 'signature_expired', 'That signature has expired. Please try linking again.')
  }

  // Rebuilt on the server from the session's own account id: a signature made
  // for a different account (or a login signature) cannot verify here.
  const message = buildLinkMessage(account.discordId, address, timestamp)
  let valid = false
  try {
    valid = await verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
  } catch {
    valid = false
  }
  if (!valid) return jsonError(400, 'invalid_signature', 'The wallet signature could not be verified.')

  const result = await linkWallet(account.ref, address)
  if (!result.ok) {
    return jsonError(409, 'wallet_taken', 'This wallet is already linked to another Portal Cap account.')
  }
  return NextResponse.json({ linkedWallet: address.toLowerCase() })
}

// DELETE: unlink the wallet
export async function DELETE() {
  const account = await discordAccount()
  if (!account) return jsonError(401, 'unauthenticated', 'Sign in with Discord to manage your wallet.')
  await unlinkWallet(account.ref)
  return NextResponse.json({ linkedWallet: null })
}
