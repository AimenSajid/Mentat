import { useEffect, useRef, useState } from 'react'
import MessageBubble from '../components/MessageBubble.jsx'

const GREETING =
  'I am a Mentat of the Imperium. My memory is the archive, not my own — ' +
  'ask, and I will compute.'

// How many prior messages travel with each request. The whole transcript used
// to be sent every turn, so cost grew with conversation length — and retrieved
// passages will be riding along on top of this once RAG lands.
const MAX_HISTORY = 10

// Mirrors the cap enforced in functions/api/chat.js, which is the real check.
const MAX_CHARS = 1000

// Date.now() twice in one tick can collide and produce duplicate React keys.
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

export default function Chat({ onBack }) {
  const [chatHistory, setChatHistory] = useState([
    // `local` marks messages that exist for the UI only and are never sent to
    // the model — the greeting is ours, not something it generated.
    { id: newId(), role: 'assistant', content: GREETING, local: true },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [chatHistory, loading])

  async function sendMessage() {
    const userInput = input.trim()
    if (!userInput || loading) return

    setInput('')
    setError('')
    const userMsg = { id: newId(), role: 'user', content: userInput }
    const newChatHistory = [...chatHistory, userMsg]
    setChatHistory(newChatHistory)
    setLoading(true)

    // Send a bounded, trimmed slice: drop UI-only messages, keep the most
    // recent MAX_HISTORY, and strip `id`/`local` so only role and content
    // reach the model.
    const forApi = newChatHistory
      .filter((m) => !m.local)
      .slice(-MAX_HISTORY)
      .map(({ role, content }) => ({ role, content }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: forApi }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || `The archive returned ${response.status}.`)
      }

      setChatHistory((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: data.reply || 'The archives are silent. Ask again.',
        },
      ])
    } catch (err) {
      // Previously this returned a string from the catch block, which went
      // nowhere and left the user staring at nothing.
      console.error(err)
      setError(err.message || 'The archive could not be reached.')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    // No .grain class here: App.jsx already applies it to the whole tree, and
    // a second fixed overlay would double the texture.
    <div className="min-h-screen bg-deep-900 flex flex-col">
      <header className="relative z-10 flex items-center justify-between px-4 md:px-8 py-4 border-b border-spice/20 bg-deep-800/60 backdrop-blur">
        <button
          onClick={onBack}
          className="font-body text-xs tracking-[0.2em] uppercase px-4 py-2 rounded-sm
                     border border-sand-dim/30 text-sand-dim
                     hover:border-spice/50 hover:text-spice transition"
        >
          ← Back
        </button>

        <span className="font-display text-sand tracking-[0.25em] text-sm md:text-base">
          MENTAT
        </span>

        <span className="font-body text-[10px] tracking-[0.25em] uppercase text-sand-dim/60 hidden sm:block">
          Imperial Archive
        </span>
      </header>

      <div ref={listRef} className="scroll-sand relative z-10 flex-1 overflow-y-auto px-4 md:px-8 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {chatHistory.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}

          {loading && (
            <div className="font-body text-sm text-spice/80 flex items-center gap-3">
              <span className="dots" aria-hidden="true">
                <span></span><span></span><span></span>
              </span>
              Consulting the archives…
            </div>
          )}

          {error && (
            <p role="alert" className="font-body text-sm text-red-400/90 border border-red-500/30 bg-red-500/5 rounded-sm px-4 py-3">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="relative z-10 px-4 md:px-8 py-5 border-t border-spice/20 bg-deep-800/60 backdrop-blur">
        <div className="max-w-3xl mx-auto flex gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_CHARS}
            aria-label="Your question"
            placeholder="Ask of the Houses, Arrakis, the spice…"
            className="font-body flex-1 resize-none rounded-sm px-4 py-3
                       bg-deep-700/70 border border-sand-dim/25 text-sand
                       placeholder-sand-dim/50
                       focus:outline-none focus:border-spice/60 transition"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="font-body px-7 rounded-sm border border-spice/50 text-spice
                       uppercase tracking-[0.2em] text-xs
                       hover:border-spice hover:text-spice-bright hover:shadow-spice
                       disabled:opacity-40 disabled:hover:shadow-none
                       transition"
          >
            Send
          </button>
        </div>
        <div className="font-body max-w-3xl mx-auto mt-2 flex justify-between text-[11px]">
          <span className="text-sand-dim/60">Enter to send · Shift+Enter for a new line</span>
          {input.length > MAX_CHARS * 0.75 && (
            <span className={input.length >= MAX_CHARS ? 'text-spice' : 'text-sand-dim/60'}>
              {input.length} / {MAX_CHARS}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
