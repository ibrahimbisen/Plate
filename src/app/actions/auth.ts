'use server'

import { randomUUID, timingSafeEqual } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { db } from '@/db'
import { preferences, reminders, users } from '@/db/schema'
import { createSession, destroySession } from '@/lib/session'
import { safeTimeZone } from '@/lib/date'

/**
 * Single-user auth: one shared passcode from the environment.
 *
 * This is a personal, self-hosted tracker — there is no signup, no user
 * management, and deliberately no OAuth (a redirect escapes an installed PWA's
 * scope and never comes back).
 */

function passwordMatches(input: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) return false
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  // Compare lengths separately so timingSafeEqual never throws on a mismatch.
  if (a.length !== b.length) {
    timingSafeEqual(a, a)
    return false
  }
  return timingSafeEqual(a, b)
}

const DEFAULT_REMINDERS = [
  { slot: 'breakfast' as const, timeOfDay: '08:30', enabled: false },
  { slot: 'lunch' as const, timeOfDay: '11:30', enabled: false },
  { slot: 'snack' as const, timeOfDay: '16:00', enabled: false },
  { slot: 'dinner' as const, timeOfDay: '18:00', enabled: false },
  { slot: 'endOfDay' as const, timeOfDay: '21:00', enabled: false },
]

export async function login(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const password = String(formData.get('password') ?? '')
  const timezone = safeTimeZone(String(formData.get('timezone') ?? ''))

  if (!process.env.APP_PASSWORD) {
    return { error: 'APP_PASSWORD is not set on the server. Add it to your .env file.' }
  }
  if (!passwordMatches(password)) {
    return { error: 'That passcode does not match.' }
  }

  // The first successful login provisions the single user.
  let user = (await db.select().from(users).limit(1))[0]

  if (!user) {
    const id = randomUUID()
    await db.insert(users).values({ id, timezone })
    await db.insert(preferences).values({ userId: id })
    await db.insert(reminders).values(
      DEFAULT_REMINDERS.map((r) => ({ id: randomUUID(), userId: id, ...r })),
    )
    user = (await db.select().from(users).where(eq(users.id, id)).limit(1))[0]
  } else if (timezone !== 'UTC' && user.timezone !== timezone) {
    // Keep the stored zone current — every daily rollup depends on it.
    await db.update(users).set({ timezone }).where(eq(users.id, user.id))
  }

  await createSession(user.id)
  redirect(user.onboardedAt ? '/' : '/onboarding')
}

export async function logout(): Promise<void> {
  await destroySession()
  redirect('/login')
}
