import { useEffect, useState } from 'react'
import { TopAppBar, type AppView } from './components/AppNav'
import { IndexView } from './views/IndexView'
import { MemoryView } from './views/MemoryView'
import { SessionsView } from './views/SessionsView'

function App() {
  const [view, setView] = useState<AppView>(() => {
    const hash = window.location.hash.replace('#', '')
    return hash === 'memory' || hash === 'index' ? hash : 'sessions'
  })

  useEffect(() => {
    window.location.hash = view
  }, [view])

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background text-on-surface">
      <TopAppBar active={view} onChange={setView} />
      <main className="flex-1 overflow-hidden">
        {view === 'sessions' && <SessionsView />}
        {view === 'memory' && <MemoryView />}
        {view === 'index' && <IndexView />}
      </main>
    </div>
  )
}

export default App
