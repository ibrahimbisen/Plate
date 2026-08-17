/**
 * Runs once on server startup.
 *
 * Migrations happen here rather than as a separate deploy step because
 * self-hosters run `docker compose up` and nothing else — there is no deploy
 * hook of ours to attach to. The `./drizzle` folder is pulled into the
 * standalone output via `outputFileTracingIncludes` in next.config.ts.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // `next build` also evaluates instrumentation while collecting page data,
  // across several worker processes. Migrating there would have N workers
  // writing the same SQLite file at once.
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  const { migrate } = await import('drizzle-orm/better-sqlite3/migrator')
  const { getDb } = await import('./src/db')

  try {
    migrate(getDb(), { migrationsFolder: './drizzle' })
    console.log('[db] migrations up to date')
  } catch (error) {
    console.error('[db] migration failed', error)
    throw error
  }
}
