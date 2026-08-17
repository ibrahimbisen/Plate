import { aiEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/dal'
import { ExerciseFlow } from './exercise-flow'

export const metadata = { title: 'Log exercise · Plate' }
export const dynamic = 'force-dynamic'

export default async function ExercisePage() {
  await requireUser()
  return <ExerciseFlow aiEnabled={aiEnabled()} />
}
