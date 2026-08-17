import { aiEnabled } from '@/lib/ai'
import { requireUser } from '@/lib/dal'
import { VoiceFlow } from './voice-flow'

export const metadata = { title: 'Voice log · Plate' }
export const dynamic = 'force-dynamic'

export default async function VoicePage() {
  await requireUser()
  return <VoiceFlow aiEnabled={aiEnabled()} sttConfigured={Boolean(process.env.STT_ENDPOINT)} />
}
