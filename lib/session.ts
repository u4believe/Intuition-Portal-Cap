import { SignJWT, jwtVerify } from 'jose'

// Define the shape of our Discord user profile for typing
export interface DiscordUser {
  id: string
  username: string
  globalName: string | null
  avatar: string | null
  authenticatedAt: number
  expiresAt: number
}

// Ensure the secret is a Uint8Array for `jose`
const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'fallback_secret_for_local_development_only_1234567890'
)

// Generate a signed JWT
export async function encryptSession(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

// Verify and decode a signed JWT
export async function decryptSession(token: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    })
    return payload
  } catch (err) {
    return null
  }
}
