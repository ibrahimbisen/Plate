'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { updateProfile } from '@/app/actions/settings'
import { ScreenHeader } from '@/components/screen-header'

const field =
  'h-14 w-full rounded-2xl border border-line bg-card px-4 text-ink outline-none focus-visible:border-ink'

export function EditProfileForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; username: string }
}) {
  const router = useRouter()
  const [state, setState] = useState(initial)
  const [pending, start] = useTransition()

  const initials =
    `${state.firstName.at(0) ?? ''}${state.lastName.at(0) ?? ''}`.toUpperCase() || 'ME'

  return (
    <div className="flex min-h-[85svh] flex-col gap-6 pb-4">
      <ScreenHeader title="Edit Profile" fallbackHref="/profile" />

      <div className="flex justify-center">
        <span
          className="grid h-28 w-28 place-items-center rounded-full text-[36px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--avatar-from), var(--avatar-to))' }}
        >
          {initials}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {(
          [
            ['firstName', 'First Name', 'given-name'],
            ['lastName', 'Last Name', 'family-name'],
            ['username', 'Username', 'off'],
          ] as const
        ).map(([key, label, autoComplete]) => (
          <label key={key} className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              {label}
            </span>
            <input
              className={field}
              value={state[key]}
              autoComplete={autoComplete}
              autoCapitalize={key === 'username' ? 'none' : 'words'}
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  [key]:
                    key === 'username'
                      ? e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                      : e.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>

      <button
        type="button"
        className="btn-primary mt-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            await updateProfile(state)
            router.push('/profile')
          })
        }
      >
        {pending ? 'Saving…' : 'Continue'}
      </button>
    </div>
  )
}
