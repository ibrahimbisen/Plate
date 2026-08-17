import 'server-only'

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const COOKIE = 'calai_session'
const MAX_AGE_S = 60 * 60 * 24 * 30 // 30 days — this is a personal daily-use app

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error(
      'SESSION_SECRET is missing or too short. Generate one with: openssl rand -base64 32',
    )
  }
  return new TextEncoder().encode(secret)
}

export type SessionPayload = { userId: string }

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secretKey())
}

export async function decryptSession(token?: string): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] })
    return typeof payload.userId === 'string' ? { userId: payload.userId } : null
  } catch {
    return null
  }
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies() // Next 16: async, sync access throws
  store.set(COOKIE, await encryptSession({ userId }), {
    httpOnly: true,
    // A self-hoster on a plain-HTTP LAN address would be locked out by an
    // unconditional `secure`. Production is expected to be behind HTTPS.
    secure: process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_COOKIE !== 'true',
    sameSite: 'lax', // 'strict' would log the user out when opening from a PWA shortcut
    path: '/',
    maxAge: MAX_AGE_S,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE)
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  return decryptSession(store.get(COOKIE)?.value)
}

export const SESSION_COOKIE = COOKIE
