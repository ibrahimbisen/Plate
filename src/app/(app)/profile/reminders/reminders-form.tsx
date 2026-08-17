'use client'

import { useEffect, useState, useTransition } from 'react'

import { updateReminder } from '@/app/actions/settings'
import { ScreenHeader } from '@/components/screen-header'

type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'endOfDay'
type Reminder = { slot: Slot; timeOfDay: string; enabled: boolean }

const LABELS: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
  endOfDay: 'End of Day',
}

const MEALS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner']

export function RemindersForm({ initial }: { initial: Reminder[] }) {
  const [rows, setRows] = useState<Reminder[]>(initial)
  const [, start] = useTransition()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [standalone, setStandalone] = useState(true)

  useEffect(() => {
    if (typeof Notification === 'undefined') setPermission('unsupported')
    else setPermission(Notification.permission)

    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as { standalone?: boolean }).standalone === true,
    )
  }, [])

  function patch(slot: Slot, next: Partial<Reminder>) {
    setRows((prev) => prev.map((r) => (r.slot === slot ? { ...r, ...next } : r)))
    start(() => void updateReminder(slot, next))
  }

  const get = (slot: Slot) =>
    rows.find((r) => r.slot === slot) ?? { slot, timeOfDay: '12:00', enabled: false }

  return (
    <div className="flex flex-col gap-5 pb-4">
      <ScreenHeader fallbackHref="/profile" />
      <h1 className="text-title">Tracking Reminders</h1>

      {/*
        On iOS, notifications require the app to be installed to the Home Screen
        AND iOS 16.4+. Asking in a Safari tab silently cannot work, so say so
        rather than showing a button that does nothing.
      */}
      {!standalone && (
        <div className="card flex flex-col gap-2 p-4">
          <p className="text-[15px] font-semibold">Add Plate to your Home Screen first</p>
          <p className="label-muted text-[14px]">
            On iPhone, reminders can only be delivered to an installed app. Until then these
            settings are saved but will not notify you.
          </p>
        </div>
      )}

      {standalone && permission === 'default' && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void Notification.requestPermission().then(setPermission)}
        >
          Allow notifications
        </button>
      )}

      {permission === 'denied' && (
        <p className="label-muted text-[14px]">
          Notifications are blocked for this app. You will need to re-enable them in your device
          settings — the browser only asks once.
        </p>
      )}

      <section className="card overflow-hidden">
        {MEALS.map((slot, i) => {
          const row = get(slot)
          return (
            <div
              key={slot}
              className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-line' : ''}`}
            >
              <span className="flex-1 text-[16px] font-semibold">{LABELS[slot]}</span>
              <input
                type="time"
                value={row.timeOfDay}
                onChange={(e) => patch(slot, { timeOfDay: e.target.value })}
                aria-label={`${LABELS[slot]} time`}
                className="h-10 rounded-full bg-fill px-3 text-[15px] font-semibold tabular outline-none"
              />
              <Toggle
                checked={row.enabled}
                label={LABELS[slot]}
                onChange={(v) => patch(slot, { enabled: v })}
              />
            </div>
          )
        })}
      </section>

      <section className="card flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex-1 text-[16px] font-semibold">{LABELS.endOfDay}</span>
          <input
            type="time"
            value={get('endOfDay').timeOfDay}
            onChange={(e) => patch('endOfDay', { timeOfDay: e.target.value })}
            aria-label="End of day time"
            className="h-10 rounded-full bg-fill px-3 text-[15px] font-semibold tabular outline-none"
          />
          <Toggle
            checked={get('endOfDay').enabled}
            label="End of day"
            onChange={(v) => patch('endOfDay', { enabled: v })}
          />
        </div>
        <p className="label-muted text-[14px]">
          Get one daily reminder and log all your meals at once.
        </p>
      </section>
    </div>
  )
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-ink' : 'bg-fill-strong'
      }`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}
