import 'server-only'

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { preferences, users, type Preferences, type User } from '@/db/schema'

/**
 * This is a single-user, self-hosted app with no login — every request acts
 * as the one user row `instrumentation.ts` provisions at server startup.
 *
 * `cache()` memoizes per render pass, so calling this in ten components costs
 * one query.
 */

export type CurrentUser = User & { preferences: Preferences }

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const rows = await db
    .select()
    .from(users)
    .leftJoin(preferences, eq(preferences.userId, users.id))
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
  if (!user) {
    throw new Error(
      'No user row found. instrumentation.ts should have provisioned one at server startup — check the server logs.',
    )
  }
  if (!user.onboardedAt) redirect('/onboarding')
  return user
})
