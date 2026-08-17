import { aiEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/dal'
import { ScanFlow } from './scan-flow'

export const metadata = { title: 'Scan food · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function ScanPage() {
  await requireUser()
  return <ScanFlow aiEnabled={aiEnabled()} />
}
