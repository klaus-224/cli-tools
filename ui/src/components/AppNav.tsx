export type AppView = 'sessions' | 'memory' | 'index'

type Props = {
  active: AppView
  onChange: (view: AppView) => void
}

export const AppNav = ({ active, onChange }: Props) => (
  <div className="app-nav">
    {[
      ['sessions', 'Sessions'],
      ['memory', 'Memory'],
      ['index', 'Index'],
    ].map(([value, label]) => (
      <button
        key={value}
        type="button"
        className={active === value ? 'app-nav__tab app-nav__tab--active' : 'app-nav__tab'}
        onClick={() => onChange(value as AppView)}
      >
        {label}
      </button>
    ))}
  </div>
)
