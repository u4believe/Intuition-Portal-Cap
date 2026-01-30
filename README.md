# Lore - Fully Decentralized dApp

A decentralized signal and monitoring application for the Intuition Portal, built entirely on the frontend with no centralized backend.

## Architecture

- **Wallet Authentication**: Sign in with MetaMask, WalletConnect, or any EVM wallet via Wagmi + RainbowKit
- **Direct GraphQL Queries**: Client-side queries directly to the Intuition Portal GraphQL API
- **Push Protocol Notifications**: Receive email alerts via decentralized Push Protocol (EPNS)
- **Local Storage**: All user preferences stored locally in browser localStorage
- **Static Deployment**: No server required, can be deployed to any static hosting (Vercel, GitHub Pages, IPFS)

## Technology Stack

- **Frontend Framework**: Next.js 16 with React 19
- **Wallet Integration**: Wagmi + RainbowKit
- **Data Fetching**: React Query + Direct GraphQL Queries
- **Notifications**: Push Protocol SDK
- **Storage**: Browser localStorage (IndexedDB-backed)
- **Deployment**: Static export (no Vercel functions needed)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

\`\`\`bash
# Clone the repository
git clone https://github.com/yourusername/lore.git
cd lore

# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your WalletConnect Project ID and Push Protocol settings
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Visit http://localhost:3000 to see the app.

### Build & Deploy

\`\`\`bash
# Build for static export
npm run build

# The output is in the .next/static directory, ready to deploy
\`\`\`

#### Deploy to Vercel (without functions)

\`\`\`bash
vercel deploy --yes
\`\`\`

#### Deploy to GitHub Pages

\`\`\`bash
npm run build
# Copy .next/static to your gh-pages branch
\`\`\`

#### Deploy to IPFS

\`\`\`bash
npm run build
# Upload .next/static directory to IPFS using Pinata, Web3.Storage, or similar
\`\`\`

## Environment Variables

Create `.env.local`:

\`\`\`env
# WalletConnect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Push Protocol (optional for email notifications)
NEXT_PUBLIC_PUSH_CHANNEL_ADDRESS=your_channel_address
NEXT_PUBLIC_PUSH_API_KEY=your_api_key
\`\`\`

## Features

- **Live Events**: Real-time stream of deposits and redemptions on the Intuition Portal
- **Top Claims**: Browse the top claims by market cap
- **All Claims & Holders**: View all claims and their token holders with share information
- **Wallet Login**: Secure authentication via wallet signature
- **Email Alerts**: Get notified via Push Protocol for important events
- **Local Preferences**: All settings stored locally under your wallet address

## User Data Privacy

- No data is sent to any central server
- All preferences stored in your browser's localStorage
- GraphQL queries go directly to Intuition Portal
- Wallet address is the only identifier used
- Push Protocol notifications are end-to-end

## Architecture Diagram

\`\`\`
User (Wallet) → Lore dApp (React) → Intuition GraphQL API
                    ↓
             localStorage (preferences)
                    ↓
             Push Protocol (email alerts)
\`\`\`

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT
