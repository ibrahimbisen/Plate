import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/db'
import { weightEntries } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { WeightFlow } from './weight-flow'

export const metadata = { title: 'Weight · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function WeightPage() {
  const user = await requireUser()

  const entries = await db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.userId, user.id))
    .orderBy(desc(weightEntries.localDate))
    .limit(120)

  return (
    <WeightFlow
      units={user.units}
      entries={entries.map((e) => ({ localDate: e.localDate, weightKg: e.weightKg }))}
    />
  )
}
