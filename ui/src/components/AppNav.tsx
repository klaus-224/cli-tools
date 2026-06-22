export type AppView = 'sessions' | 'memory' | 'index'

type Props = {
  active: AppView
  onChange: (view: AppView) => void
}

const navItems: { value: AppView; label: string }[] = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'memory', label: 'Memory' },
  { value: 'index', label: 'Index' },
]

export const TopAppBar = ({ active, onChange }: Props) => (
  <header className="bg-surface-dim border-b border-outline-variant flex items-center w-full px-8 h-16 shrink-0 z-50">
    <div className="flex items-center gap-8">
      <span className="text-xl font-bold text-primary font-sans">Agent Tool UI</span>
      <nav className="hidden md:flex items-center gap-6">
        {navItems.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={
              active === value
                ? 'text-primary font-bold border-b-2 border-primary pb-1 text-sm cursor-pointer'
                : 'text-on-surface-variant font-medium hover:text-primary transition-colors duration-200 text-sm cursor-pointer'
            }
          >
            {label}
          </button>
        ))}
      </nav>
    </div>
  </header>
)
