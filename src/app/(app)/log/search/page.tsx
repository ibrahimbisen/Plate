import { requireUser } from '@/lib/dal'
import { SearchFlow } from './search-flow'

export const metadata = { title: 'Log food · Plate' }
export const dynamic = 'force-dynamic'

export default async function SearchPage() {
  await requireUser()
  return <SearchFlow />
}
