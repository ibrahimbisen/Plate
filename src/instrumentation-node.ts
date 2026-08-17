import { randomUUID } from 'node:crypto'

import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import { getDb } from '@/db'
import { preferences, reminders, users } from '@/db/schema'

/**
 * This app has no login — it's single-user and unauthenticated by design, so
 * there's no sign-in step to provision the one user row on first use. Instead
 * it's provisioned here, once, before any request can race it.
 */
const DEFAULT_REMINDERS = [
  { slot: 'breakfast' as const, timeOfDay: '08:30', enabled: false },
  { slot: 'lunch' as const, timeOfDay: '11:30', enabled: false },
  { slot: 'snack' as const, timeOfDay: '16:00', enabled: false },
  { slot: 'dinner' as const, timeOfDay: '18:00', enabled: false },
  { slot: 'endOfDay' as const, timeOfDay: '21:00', enabled: false },
]

// `next build` also evaluates instrumentation while collecting page data,
// across several worker processes. Migrating there would have N workers
// writing the same SQLite file at once.
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  const db = getDb()

  try {
    migrate(db, { migrationsFolder: './drizzle' })
    console.log('[db] migrations up to date')
  } catch (error) {
    console.error('[db] migration failed', error)
    throw error
  }

  const existing = (await db.select().from(users).limit(1))[0]
  if (!existing) {
    const id = randomUUID()
    await db.insert(users).values({ id, timezone: 'UTC' })
    await db.insert(preferences).values({ userId: id })
    await db
      .insert(reminders)
      .values(DEFAULT_REMINDERS.map((r) => ({ id: randomUUID(), userId: id, ...r })))
    console.log('[db] provisioned the single user row')
  }
}
