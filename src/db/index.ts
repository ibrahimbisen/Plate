import 'server-only'

import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import type BetterSqlite3 from 'better-sqlite3'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'

import * as schema from './schema'

/**
 * The connection is created lazily, on first query.
 *
 * Two reasons this matters, both learned the hard way:
 *
 *   1. `next build` collects page data in several parallel worker processes.
 *      If importing a page module opened a SQLite handle, every worker would
 *      open the same file at once and the native addon segfaults the worker.
 *   2. Dev HMR re-evaluates modules constantly; caching on globalThis keeps one
 *      handle instead of leaking a file descriptor per edit.
 */

type Db = BetterSQLite3Database<typeof schema>

const globalForDb = globalThis as unknown as {
  __sqlite?: BetterSqlite3.Database
  __db?: Db
}

function connect(): { sqlite: BetterSqlite3.Database; db: Db } {
  if (globalForDb.__sqlite && globalForDb.__db) {
    return { sqlite: globalForDb.__sqlite, db: globalForDb.__db }
  }

  // Required, not imported at module scope — keeps the native addon out of the
  // import graph until something actually queries.
  const Database = require('better-sqlite3') as typeof BetterSqlite3
  const { drizzle } = require('drizzle-orm/better-sqlite3') as {
    drizzle: (c: BetterSqlite3.Database, o: { schema: typeof schema }) => Db
  }

  const path = process.env.DATABASE_PATH ?? './data/app.db'
  mkdirSync(dirname(path), { recursive: true })

  const sqlite = new Database(path)
  sqlite.pragma('journal_mode = WAL') // concurrent readers alongside one writer
  sqlite.pragma('synchronous = NORMAL') // safe under WAL, materially faster
  sqlite.pragma('foreign_keys = ON') // SQLite IGNORES FK constraints without this
  sqlite.pragma('busy_timeout = 5000')

  const db = drizzle(sqlite, { schema })
  globalForDb.__sqlite = sqlite
  globalForDb.__db = db
  return { sqlite, db }
}

export function getDb(): Db {
  return connect().db
}

export function getSqlite(): BetterSqlite3.Database {
  return connect().sqlite
}

/**
 * Ergonomic `db.select()...` access that still defers the connection until the
 * first property read.
 */
export const db = new Proxy({} as Db, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver)
  },
}) as Db

export { schema }
