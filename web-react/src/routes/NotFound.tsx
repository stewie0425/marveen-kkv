import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <h1 className="text-3xl font-semibold tracking-tight">404</h1>
      <p className="mt-2 text-sm text-[var(--color-text-muted)]">
        Ilyen oldal nincs.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        Vissza az áttekintéshez
      </Link>
    </section>
  )
}
