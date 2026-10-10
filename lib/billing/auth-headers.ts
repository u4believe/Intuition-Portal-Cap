/**
 * Client-side: attaches the wallet sign-in proof to billing API calls.
 * Discord sessions ride on the httpOnly cookie, so nothing is needed for them.
 */
export const WALLET_AUTH_HEADER = 'x-portal-wallet-auth'

export function billingAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const stored = localStorage.getItem('portal_cap_auth')
    if (!stored) return {}
    const { address, message, signature } = JSON.parse(stored)
    if (!address || !message || !signature) return {}
    return { [WALLET_AUTH_HEADER]: btoa(JSON.stringify({ address, message, signature })) }
  } catch {
    return {}
  }
}
