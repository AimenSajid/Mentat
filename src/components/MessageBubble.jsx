/**
 * Collapse the raw match list into one entry per article.
 *
 * Long articles are split across several chunks at index time, so a single
 * source can match more than once. Showing "Paul Atreides · Paul Atreides ·
 * Arrakis" would look broken; keep each title once, at its best score.
 */
function dedupeSources(sources) {
  const best = new Map()

  for (const { title, score } of sources ?? []) {
    if (!title) continue
    if (!best.has(title) || best.get(title) < score) {
      best.set(title, score)
    }
  }

  return [...best.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([title, score]) => ({ title, score }))
}

export default function MessageBubble({ role, content, sources }) {
  const isAssistant = role === 'assistant'
  const cited = isAssistant ? dedupeSources(sources) : []

  return (
    <div className={`flex animate-rise ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[85%] md:max-w-[72%]">
        <p
          className={`font-body text-[10px] tracking-[0.3em] uppercase mb-1.5
          ${isAssistant ? 'text-spice/70 text-left' : 'text-ibad/70 text-right'}`}
        >
          {isAssistant ? 'Mentat' : 'You'}
        </p>

        <div
          className={`font-body rounded-sm px-5 py-4 leading-relaxed border
          ${isAssistant
            ? 'bg-spice/[0.04] border-spice/35 text-sand shadow-spice'
            : 'bg-ibad/[0.05] border-ibad/35 text-sand shadow-ibad'
          }`}
        >
          <p className="whitespace-pre-wrap">{content}</p>
        </div>

        {cited.length > 0 && (
          <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-body text-[10px] tracking-[0.25em] uppercase text-sand-dim/70">
              Drawn from
            </span>
            {cited.map(({ title, score }) => (
              <span
                key={title}
                className="font-body text-[11px] text-sand-dim border border-sand-dim/25
                           rounded-sm px-2 py-0.5"
                title={`Similarity ${score}`}
              >
                {title}
                <span className="text-sand-dim/50 ml-1.5">{score.toFixed(2)}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
