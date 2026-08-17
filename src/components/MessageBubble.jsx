export default function MessageBubble({ role, content }) {
  const isAssistant = role === 'assistant'

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
      </div>
    </div>
  )
}
