/**
 * Line icons at stroke 1.75, matching the app's monochrome iconography.
 * Hand-rolled rather than pulled from a library so the bundle stays small and
 * every glyph matches the screenshots.
 */

type IconProps = { size?: number; className?: string; strokeWidth?: number }

function Svg({
  size = 24,
  className,
  strokeWidth = 1.75,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
  </Svg>
)

export const ChartIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="12" width="4" height="8" rx="1.2" />
    <rect x="10" y="7" width="4" height="13" rx="1.2" />
    <rect x="17" y="10" width="4" height="10" rx="1.2" />
  </Svg>
)

export const PersonIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
)

export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
)

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
)

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
)

export const ChevronUpDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 10l4-4 4 4M8 14l4 4 4-4" />
  </Svg>
)

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.6-3.6" />
  </Svg>
)

export const CameraIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Svg>
)

export const ScanIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const BarcodeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6v12M7.5 6v12M11 6v12M14.5 6v12M18 6v12M20.5 6v12" />
  </Svg>
)

export const LabelIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </Svg>
)

export const DumbbellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
  </Svg>
)

export const BookmarkIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <Svg {...p}>
    <path d="M6 4h12v17l-6-4-6 4V4Z" fill={filled ? 'currentColor' : 'none'} />
  </Svg>
)

export const MicIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </Svg>
)

export const NoteIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h4" />
  </Svg>
)

export const PencilIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1Z" />
  </Svg>
)

export const RunIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="14.5" cy="4.5" r="1.8" />
    <path d="m9 21 2.5-5-2.5-3 1-5 3.5 2 3 1.5M6 12l3-2M13 13l3 2 1 4" />
  </Svg>
)

export const FlameIcon = ({ filled, ...p }: IconProps & { filled?: boolean }) => (
  <svg
    width={p.size ?? 24}
    height={p.size ?? 24}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={p.strokeWidth ?? 1.75}
    strokeLinejoin="round"
    className={p.className}
    aria-hidden="true"
  >
    <path d="M12 2.5c3.2 3 4.8 5.6 4.8 8a4.8 4.8 0 0 1-9.6 0c0-.9.2-1.7.6-2.5.6 1 1.4 1.6 2.3 1.8-.5-2.6.1-5 1.9-7.3Z" />
  </svg>
)

export const SettingsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </Svg>
)

export const TargetIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Svg>
)

export const FlagIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 21V4M5 5h11l-2 3 2 3H5" />
  </Svg>
)

export const IdIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="9" cy="11" r="2" />
    <path d="M6 16c.7-1.4 1.8-2 3-2s2.3.6 3 2M15 10h4M15 14h3" />
  </Svg>
)

export const BellIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
    <path d="M10 18a2 2 0 0 0 4 0" />
  </Svg>
)

export const ShareIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 15V3M8.5 6.5 12 3l3.5 3.5" />
    <path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" />
  </Svg>
)

export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.4" fill="currentColor" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    <circle cx="19" cy="12" r="1.4" fill="currentColor" />
  </Svg>
)

export const SparkleIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.7 9l5.3 1.7-5.3 1.7L12 18l-1.7-5.6L5 10.7 10.3 9 12 3.5Z" />
    <path d="M18.5 3.5 19 5l1.5.5L19 6l-.5 1.5L18 6l-1.5-.5L18 5l.5-1.5Z" />
  </Svg>
)

export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7v13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M10 11v6M14 11v6" />
  </Svg>
)

export const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
)

export const ArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7M8 7h9v9" />
  </Svg>
)

export const ArrowDownRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 7l10 10M17 8v9H8" />
  </Svg>
)

export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
)

export const LogoutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" />
    <path d="M10 8 6 12l4 4M6 12h9" />
  </Svg>
)

export const ImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10" r="1.5" />
    <path d="m4 17 5-4 4 3 3-2 4 3" />
  </Svg>
)

/** The apple mark in the header — solid, matching the wordmark lockup. */
export const AppleMark = ({ size = 28, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.2 6.6c2.9-1.4 5.6.3 6.4 2.4 1 2.6.1 6.5-1.7 9-.9 1.2-1.8 2.4-3.1 2.4-1.2 0-1.7-.8-3.1-.8s-1.9.8-3.1.8c-1.3 0-2.3-1.3-3.2-2.5-2-2.9-2.6-7.6-.6-10 1-1.2 2.4-1.9 3.9-1.9 1.4 0 2.3.9 3.5.9.4 0 .6-.1 1-.3Z" />
    <path d="M13.9 2c.2 1-.2 2-.8 2.7-.6.7-1.6 1.3-2.6 1.2-.2-1 .3-2 .9-2.7.6-.7 1.7-1.2 2.5-1.2Z" />
  </svg>
)
