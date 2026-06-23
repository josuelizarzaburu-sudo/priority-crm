import { cn } from '@/lib/utils'

type LeadOrigin = 'PRIORITY_HEALTH' | 'PROPIO'

const LEAD_ORIGIN_META: Record<LeadOrigin, { label: string; bg: string }> = {
  PRIORITY_HEALTH: { label: 'Priority Health', bg: '#DBAA59' },
  PROPIO: { label: 'Propio', bg: '#0C2057' },
}

export function LeadOriginBadge({
  leadOrigin,
  className,
}: {
  leadOrigin?: string | null
  className?: string
}) {
  const meta = leadOrigin === 'PRIORITY_HEALTH' || leadOrigin === 'PROPIO' ? LEAD_ORIGIN_META[leadOrigin] : null
  if (!meta) return null
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white', className)}
      style={{ backgroundColor: meta.bg }}
    >
      {meta.label}
    </span>
  )
}
