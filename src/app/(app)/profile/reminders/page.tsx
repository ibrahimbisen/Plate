import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { reminders } from '@/db/schema'
import { requireUser } from '@/lib/dal'
import { RemindersForm } from './reminders-form'

export const metadata = { title: 'Tracking reminders · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function RemindersPage() {
  const user = await requireUser()
  const rows = await db.select().from(reminders).where(eq(reminders.userId, user.id))

  return (
    <RemindersForm
      initial={rows.map((r) => ({ slot: r.slot, timeOfDay: r.timeOfDay, enabled: r.enabled }))}
    />
  )
}
