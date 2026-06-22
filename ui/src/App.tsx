import { useEffect, useState } from 'react'
import { AppNav, type AppView } from './components/AppNav'
import { IndexView } from './views/IndexView'
import { MemoryView } from './views/MemoryView'
import { SessionsView } from './views/SessionsView'
import './App.css'

function App() {
  const [view, setView] = useState<AppView>(() => {
    const hash = window.location.hash.replace('#', '')
    return hash === 'memory' || hash === 'index' ? hash : 'sessions'
  })

  useEffect(() => {
    window.location.hash = view
  }, [view])

  return (
    <div className="app-frame">
      <header className="app-frame__header">
        <div>
          <div className="eyebrow">Session Reviewer</div>
          <h1>Agent data browser</h1>
          <p className="muted">Sessions, agent memory, and project index in one place.</p>
        </div>
        <AppNav active={view} onChange={setView} />
      </header>

      {view === 'sessions' && <SessionsView />}
      {view === 'memory' && <MemoryView />}
      {view === 'index' && <IndexView />}
    </div>
  )
}

export default App
