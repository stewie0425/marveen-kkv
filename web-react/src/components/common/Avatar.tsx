import { useState } from 'react'

interface Props {
  src: string | null | undefined
  name: string
  size?: number
  className?: string
}

// Image with initials fallback. The legacy code keyed gradients by a name
// hash; we simplify to a single accent-soft tile so the visual stays calm
// and any rare avatar load failure is unobtrusive.
export function Avatar({ src, name, size = 36, className = '' }: Props) {
  const [errored, setErrored] = useState(false)
  const initial = (name || '?').charAt(0).toUpperCase()
  const dim = { width: size, height: size }
  const ringClass =
    'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)] font-semibold'

  if (!src || errored) {
    return (
      <div
        className={`${ringClass} ${className}`}
        style={{ ...dim, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    )
  }

  return (
    <div className={`${ringClass} ${className}`} style={dim}>
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setErrored(true)}
      />
    </div>
  )
}
