import { createConfig, http } from 'wagmi'
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID

// Build connectors array - only include walletConnect if projectId is available
const connectors = [injected({ shimDisconnect: true })]

if (projectId && projectId.trim() !== '') {
  connectors.push(
    walletConnect({
      projectId,
    })
  )
}

export const config = createConfig({
  chains: [mainnet, sepolia, polygon, optimism, arbitrum, base],
  connectors,
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
  },
  ssr: false,
})
