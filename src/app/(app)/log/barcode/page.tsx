import { requireUser } from '@/lib/dal'
import { BarcodeFlow } from './barcode-flow'

export const metadata = { title: 'Scan barcode · Cal AI' }
export const dynamic = 'force-dynamic'

export default async function BarcodePage() {
  await requireUser()
  return <BarcodeFlow />
}
