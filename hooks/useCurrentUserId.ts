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

  if (address) return address
  if (discordUser) return `discord:${discordUser.id}`
  return undefined
}
