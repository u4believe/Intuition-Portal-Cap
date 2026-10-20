/**
 * Wallets linked to non-wallet sign-ins (Discord). Server-only.
 */
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

const UNDEFINED_TABLE = '42P01'

/** The linked wallet (lowercased), or null. Null too if migration 13 hasn't run. */
export async function getLinkedWallet(accountRef: string): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ wallet_address: string }>(
      'SELECT wallet_address FROM account_wallet_links WHERE account_ref = $1',
      [accountRef]
    )
    return rows[0]?.wallet_address ?? null
  } catch (err: any) {
    if (err?.code === UNDEFINED_TABLE) return null
    throw err
  }
}

export type LinkResult = { ok: true } | { ok: false; reason: 'wallet_taken' }

/** Links (or re-links) the account to this wallet. A wallet belongs to one account. */
export async function linkWallet(accountRef: string, walletAddress: string): Promise<LinkResult> {
  const address = walletAddress.toLowerCase()
  try {
    await pool.query(
      `INSERT INTO account_wallet_links (account_ref, wallet_address) VALUES ($1, $2)
       ON CONFLICT (account_ref) DO UPDATE SET wallet_address = EXCLUDED.wallet_address, linked_at = NOW()`,
      [accountRef, address]
    )
    return { ok: true }
  } catch (err: any) {
    // unique_violation on wallet_address: already linked to a different account
    if (err?.code === '23505') return { ok: false, reason: 'wallet_taken' }
    throw err
  }
}

export async function unlinkWallet(accountRef: string): Promise<void> {
  await pool.query('DELETE FROM account_wallet_links WHERE account_ref = $1', [accountRef])
}
