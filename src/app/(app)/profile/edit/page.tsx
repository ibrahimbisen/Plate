import { requireUser } from '@/lib/dal'
import { EditProfileForm } from './edit-form'

export const metadata = { title: 'Edit profile · Plate' }
export const dynamic = 'force-dynamic'

export default async function EditProfilePage() {
  const user = await requireUser()

  return (
    <EditProfileForm
      initial={{
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
      }}
    />
  )
}
