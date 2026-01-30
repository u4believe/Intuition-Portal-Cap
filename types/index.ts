export interface Claim {
  label: string
  image: string | null
  marketCap: number
  positionCount: number
  lastSharePrice: number
  holders: Array<{
    accountId: string
    shares: number
  }>
}

export interface Event {
  type: 'deposit' | 'redemption'
  tripleName: string
  senderId?: string
  receiverId?: string
  timestamp: string
}

export type ClaimData = Claim
