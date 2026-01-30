'use client'

import { useConnect } from 'wagmi'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Wallet } from 'lucide-react'

export function WalletConnectButton() {
  const { connectors, connect, isPending, error } = useConnect()
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null)

  const handleConnect = (connectorUid: string) => {
    setSelectedConnector(connectorUid)
    const connector = connectors.find((c) => c.uid === connectorUid)
    if (connector) {
      connect({ connector })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {connectors.map((connector) => (
        <div key={connector.uid}>
          <Button
            onClick={() => handleConnect(connector.uid)}
            variant="outline"
            className="gap-2 w-full justify-start"
            disabled={isPending && selectedConnector === connector.uid}
            type="button"
          >
            <Wallet className="w-4 h-4" />
            {isPending && selectedConnector === connector.uid ? (
              <span>Connecting...</span>
            ) : (
              <span>{connector.name}</span>
            )}
          </Button>
          {error && selectedConnector === connector.uid && (
            <p className="text-xs text-red-500 mt-1">
              Failed to connect. Please try again.
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
