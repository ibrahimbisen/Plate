'use client'

import { useActionState, useEffect, useRef } from 'react'

import { login } from '@/app/actions/auth'
import { AppleMark } from '@/components/icons'

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(login, undefined)
  const tzRef = useRef<HTMLInputElement>(null)

  // The server needs the browser's IANA zone to bucket logs by civil date.
  useEffect(() => {
    if (tzRef.current) {
      tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'
    }
  }, [])

  return (
    <>
      <header className="flex flex-col items-center gap-3 text-center">
        <AppleMark size={44} />
        <h1 className="text-title">Cal AI</h1>
        <p className="label-muted max-w-[30ch]">
          Track calories and macros from a photo, a barcode, or your voice.
        </p>
      </header>

      {configured ? (
        <form action={action} className="card flex flex-col gap-4 p-5">
          <input type="hidden" name="timezone" ref={tzRef} defaultValue="UTC" />

          <label className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">
              Passcode
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
              enterKeyHint="go"
              className="h-14 rounded-2xl border border-line bg-card-muted px-4 text-ink outline-none focus-visible:border-ink"
            />
          </label>

          {state?.error && (
            <p role="alert" className="text-[15px] text-bad">
              {state.error}
            </p>
          )}

          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? 'Checking…' : 'Continue'}
          </button>
        </form>
      ) : (
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="text-[17px] font-semibold">Finish setting up the server</h2>
          <p className="label-muted">
            No passcode is configured yet. Copy <code className="chip">.env.example</code> to{' '}
            <code className="chip">.env</code>, then set <code className="chip">APP_PASSWORD</code>{' '}
            and <code className="chip">SESSION_SECRET</code> and restart.
          </p>
          <pre className="overflow-x-auto rounded-2xl bg-fill p-4 text-[13px] leading-relaxed">
            {`cp .env.example .env
echo "SESSION_SECRET=$(openssl rand -base64 32)" >> .env
echo "APP_PASSWORD=choose-a-passcode" >> .env`}
          </pre>
        </div>
      )}
    </>
  )
}
