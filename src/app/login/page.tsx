import { redirect } from 'next/navigation'

import { getSession } from '@/lib/dal'
import { LoginForm } from './login-form'

export const metadata = { title: 'Sign in · Cal AI' }

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  const configured = Boolean(process.env.APP_PASSWORD)

  return (
    <main className="app-frame">
      <div className="app-scroll">
        <div className="app-shell flex min-h-[70svh] flex-col justify-center gap-8 py-10">
          <LoginForm configured={configured} />
        </div>
      </div>
    </main>
  )
}
