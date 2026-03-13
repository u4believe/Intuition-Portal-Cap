'use client'

import { useAccount } from 'wagmi'
import { useDiscordAuth } from './useDiscordAuth'

/**
 * Returns a stable user identifier regardless of auth method.
 * Wallet users → their address (0x...)
 * Discord users → "discord:<id>"
 * Not signed in → undefined
 */
export function useCurrentUserId(): string | undefined {
  const { address } = useAccount()
  const { discordUser } = useDiscordAuth()

  // Discord sign-in takes priority when the user explicitly authenticated via Discord.
  // Wallet address is used when there is no Discord session.
  // This ensures a Discord user does not get silently routed to the wallet identity
  // just because MetaMask happens to be connected in the same browser.
  if (discordUser) return `discord:${discordUser.id}`
  if (address) return address
  return undefined
}
