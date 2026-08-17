import { useState } from 'react'
import Landing from './pages/Landing.jsx'
import Chat from './pages/Chat.jsx'

export default function App() {
  const [route, setRoute] = useState('landing')

  return (
    <div className="grain min-h-screen bg-deep-900 text-sand font-body">
      {route === 'landing' ? (
        <Landing onStart={() => setRoute('chat')} />
      ) : (
        <Chat onBack={() => setRoute('landing')} />
      )}
    </div>
  )
}
