import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { preferences, users, type Preferences, type User } from '@/db/schema'
import { readSession } from './session'

/**
 * The Data Access Layer is where authorization is actually enforced.
 *
 * Deliberately NOT in a layout: layouts do not re-render on navigation
 * (partial rendering), and a layout that hides its children does not stop them
 * rendering or appearing in the RSC payload. Every page, Server Action and
 * route handler calls this itself.
 *
 * `cache()` memoizes per render pass, so calling it in ten components costs
 * one verify and one query.
 */

export const getSession = cache(readSession)

export const verifySession = cache(async (): Promise<{ userId: string }> => {
  const session = await readSession()
  if (!session?.userId) redirect('/login')
  return { userId: session.userId }
})

export type CurrentUser = User & { preferences: Preferences }

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession()
  if (!session?.userId) return null

  const rows = await db
    .select()
    .from(users)
    .leftJoin(preferences, eq(preferences.userId, users.id))
    .where(eq(users.id, session.userId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    ...row.users,
    preferences: row.preferences ?? {
      userId: row.users.id,
      appearance: 'system',
      badgeCelebrations: true,
      addBurnedCalories: true,
      rolloverCalories: true,
      autoAdjustMacros: true,
    },
  }
})

/** Pages that require a fully onboarded user. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.onboardedAt) redirect('/onboarding')
  return user
})
