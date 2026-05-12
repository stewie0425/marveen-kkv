export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms < 0) return ''
  const s = Math.floor(ms / 1000)
  if (s < 60) return s + 's'
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return m + 'm ' + rs + 's'
  const h = Math.floor(m / 60)
  const rm = m % 60
  return h + 'h ' + rm + 'm'
}

// Compact relative timestamp ("most", "5p", "3ó", "2n"). Mirrors the
// helper in the legacy web/app.js so the feel stays identical.
export function formatRelative(ts: number): string {
  const diff = Math.max(0, Date.now() - ts)
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'most'
  if (min < 60) return `${min}p`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}ó`
  const day = Math.floor(hr / 24)
  return `${day}n`
}

// Hungarian thousand-separator. The legacy code did `toLocaleString('hu-HU')
// .replace(/,/g, ' ')`; we centralise it here.
export function formatNumber(n: number): string {
  return n.toLocaleString('hu-HU').replace(/,/g, ' ')
}

// Local date+time string for incident pubDate. The legacy used
// Europe/Budapest; we honour that so the dashboard renders the same time
// regardless of viewer locale.
export function formatIncidentDate(pubDate: string): string {
  const d = new Date(pubDate)
  if (isNaN(d.getTime())) return pubDate
  return d.toLocaleString('hu-HU', { timeZone: 'Europe/Budapest' })
}
