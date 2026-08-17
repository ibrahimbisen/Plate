import { requireUser } from '@/lib/dal'
import { ManualForm } from './manual-form'

export const metadata = { title: 'Add manually · Plate' }
export const dynamic = 'force-dynamic'

export default async function ManualPage() {
  await requireUser()
  return <ManualForm />
}
