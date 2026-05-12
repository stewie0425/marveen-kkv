// Prebuilt gallery list. The 20 PNGs ship from web-react/public/avatars/
// (copied during the Phase 7 cutover) and are served at /avatars/*.png.
// The numbered prefix preserves the legacy ordering.
const GALLERY: Array<{ file: string; label: string }> = [
  { file: '01_robot.png', label: 'Robot' },
  { file: '02_wizard_girl.png', label: 'Wizard girl' },
  { file: '03_knight.png', label: 'Knight' },
  { file: '04_ninja.png', label: 'Ninja' },
  { file: '05_pirate.png', label: 'Pirate' },
  { file: '06_scientist_girl.png', label: 'Scientist' },
  { file: '07_astronaut.png', label: 'Astronaut' },
  { file: '08_viking.png', label: 'Viking' },
  { file: '09_cowgirl.png', label: 'Cowgirl' },
  { file: '10_detective.png', label: 'Detective' },
  { file: '11_chef.png', label: 'Chef' },
  { file: '12_witch.png', label: 'Witch' },
  { file: '13_samurai.png', label: 'Samurai' },
  { file: '14_fairy_girl.png', label: 'Fairy' },
  { file: '15_firefighter.png', label: 'Firefighter' },
  { file: '16_punk_girl.png', label: 'Punk' },
  { file: '17_explorer.png', label: 'Explorer' },
  { file: '18_dj.png', label: 'DJ' },
  { file: '19_princess.png', label: 'Princess' },
  { file: '20_alien.png', label: 'Alien' },
]

interface Props {
  onSelect: (file: string) => void
  isPending?: boolean
  selected?: string | null
}

export function AvatarGallery({ onSelect, isPending, selected }: Props) {
  return (
    <div
      role="listbox"
      aria-label="Avatar galéria"
      className="grid grid-cols-4 gap-2 sm:grid-cols-5"
    >
      {GALLERY.map((g) => {
        const isSelected = selected === g.file
        return (
          <button
            key={g.file}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={isPending}
            onClick={() => onSelect(g.file)}
            title={g.label}
            className={[
              'group flex flex-col items-center gap-1 rounded-[var(--radius-sm)] border p-2 transition-colors',
              isSelected
                ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]',
              isPending ? 'opacity-60' : '',
            ].join(' ')}
          >
            <img
              src={`/avatars/${g.file}`}
              alt=""
              loading="lazy"
              className="h-14 w-14 rounded-full object-cover"
            />
            <span className="truncate text-[10px] text-[var(--color-text-muted)] group-hover:text-[var(--color-text)]">
              {g.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
