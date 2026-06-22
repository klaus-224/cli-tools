const parseDate = (value: string | null): Date | null => {
  if (!value) return null
  const numeric = Number(value)
  if (Number.isFinite(numeric) && `${numeric}` === value.trim()) {
    const date = new Date(numeric)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const formatTimestamp = (value: string | null): string => {
  const date = parseDate(value)
  if (!date) return value ?? 'unknown time'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export const formatRelative = (value: string | null): string => {
  const date = parseDate(value)
  if (!date) return value ?? 'unknown'
  const delta = Date.now() - date.getTime()
  const minutes = Math.round(delta / 60000)
  if (Math.abs(minutes) < 60) return `${Math.max(1, Math.abs(minutes))}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${Math.abs(hours)}h ago`
  const days = Math.round(hours / 24)
  return `${Math.abs(days)}d ago`
}

export const compactText = (value: string | null | undefined): string => {
  if (!value) return 'unknown'
  if (value.length <= 14) return value
  return `${value.slice(0, 5)}…${value.slice(-6)}`
}
