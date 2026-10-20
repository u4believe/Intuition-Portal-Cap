/**
 * The message a wallet signs to link itself to a Discord account. Shared by
 * the browser (to sign) and the server (to rebuild and verify), so the two
 * can't drift. It names the account and carries a timestamp, so a login
 * signature can't be replayed as a link and a link can't be moved to
 * another account.
 */
export const LINK_MESSAGE_MAX_AGE_MS = 10 * 60 * 1000

export function buildLinkMessage(discordId: string, address: string, timestamp: number): string {
  return [
    'Link this wallet to your Portal Cap account',
    '',
    `Discord account: ${discordId}`,
    `Wallet: ${address}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')
}
