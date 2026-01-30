'use client'

import { useConnect } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'

export function WalletConnectButton() {
  const { connectors, connect } = useConnect()

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <Button
          key={connector.uid}
          onClick={() => connect({ connector })}
          variant="outline"
          className="gap-2"
        >
          <Wallet className="w-4 h-4" />
          {connector.name}
        </Button>
      ))}
    </div>
  )
}
