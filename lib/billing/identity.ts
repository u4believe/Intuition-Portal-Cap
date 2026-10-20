/**
 * Resolves the signed-in user for billing routes, verified server-side.
 *
 * Wallet users: the client sends the sign-in proof it keeps in localStorage
 * ('portal_cap_auth') as the x-portal-wallet-auth header (base64 JSON); we
 * recover the signer from the signature rather than trusting the address.
 * Discord users: the signed portal_cap_session cookie.
 */
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { isAddress, verifyMessage } from 'viem'
import { decryptSession } from '@/lib/session'
import { getLinkedWallet } from '@/lib/account/wallet-links'

export const WALLET_AUTH_HEADER = 'x-portal-wallet-auth'

// Sign-in proofs are never refreshed client-side, so cap how old one may be.
const MAX_WALLET_PROOF_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type BillingIdentity =
  | { kind: 'wallet'; ref: string; address: `0x${string}` }
  | { kind: 'discord'; ref: string; discordId: string; linkedWallet: `0x${string}` | null }

export type IdentityResult =
  | { ok: true; identity: BillingIdentity }
  | { ok: false; reason: 'unauthenticated' | 'wallet_proof_invalid' | 'wallet_proof_expired' }

async function verifyWalletProof(header: string): Promise<IdentityResult> {
  let proof: { address?: string; message?: string; signature?: string }
  try {
    proof = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
  } catch {
    return { ok: false, reason: 'wallet_proof_invalid' }
  }

  const { address, message, signature } = proof
  if (!address || !message || !signature || !isAddress(address)) {
    return { ok: false, reason: 'wallet_proof_invalid' }
  }

  // Message format comes from app/auth/login/page.tsx
  const walletLine = message.match(/^Wallet: (0x[0-9a-fA-F]{40})$/m)
  const timestampLine = message.match(/^Timestamp: (\d+)$/m)
  if (
    !message.startsWith('Sign this message to authenticate with Portal Cap') ||
    !walletLine ||
    walletLine[1].toLowerCase() !== address.toLowerCase() ||
    !timestampLine
  ) {
    return { ok: false, reason: 'wallet_proof_invalid' }
  }

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    })
    if (!valid) return { ok: false, reason: 'wallet_proof_invalid' }
  } catch {
    return { ok: false, reason: 'wallet_proof_invalid' }
  }

  if (Date.now() - Number(timestampLine[1]) > MAX_WALLET_PROOF_AGE_MS) {
    return { ok: false, reason: 'wallet_proof_expired' }
  }

  const normalized = address.toLowerCase() as `0x${string}`
  return { ok: true, identity: { kind: 'wallet', ref: `wallet:${normalized}`, address: normalized } }
}

export async function resolveBillingIdentity(req: NextRequest): Promise<IdentityResult> {
  const walletHeader = req.headers.get(WALLET_AUTH_HEADER)
  if (walletHeader) return verifyWalletProof(walletHeader)

  const token = (await cookies()).get('portal_cap_session')?.value
  if (token) {
    const session = await decryptSession(token)
    if (session?.id && (!session.expiresAt || session.expiresAt > Date.now())) {
      const discordId = String(session.id)
      const ref = `discord:${discordId}`
      const linkedWallet = (await getLinkedWallet(ref)) as `0x${string}` | null
      return { ok: true, identity: { kind: 'discord', ref, discordId, linkedWallet } }
    }
  }

  return { ok: false, reason: 'unauthenticated' }
}

/** The user's verified wallet: the one they signed in with, or one linked to their account. */
export function walletOf(identity: BillingIdentity): `0x${string}` | null {
  return identity.kind === 'wallet' ? identity.address : identity.linkedWallet
}

export const IDENTITY_ERRORS: Record<Exclude<IdentityResult, { ok: true }>['reason'], string> = {
  unauthenticated: 'Sign in to manage your subscription.',
  wallet_proof_invalid: 'Your wallet sign-in could not be verified. Please sign in again.',
  wallet_proof_expired: 'Your wallet sign-in has expired. Please sign in again.',
}
