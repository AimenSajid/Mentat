export default function Landing({ onStart }) {
  return (
    <div className="relative min-h-screen bg-deep-900 bg-dunes flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
      {/* Horizon line, low on the screen, suggesting a dune crest. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-spice-deep/15 to-transparent" />

      <div className="relative z-10 flex flex-col items-center animate-rise">
        <p className="font-body text-xs md:text-sm tracking-[0.55em] text-sand-dim uppercase mb-8">
          Imperial Archive
        </p>

        <h1 className="haze font-display text-4xl md:text-7xl tracking-[0.18em] text-sand text-center">
          MENTAT
        </h1>

        <div className="rule w-56 md:w-96 mt-8" />

        <p className="font-body mt-10 max-w-xl text-center text-lg md:text-xl leading-relaxed text-sand/85">
          Thinking machines are forbidden. I am what came after.
        </p>

        <p className="font-body mt-4 max-w-lg text-center text-sm md:text-base leading-relaxed text-sand-dim">
          Ask me of Arrakis, the Great Houses, the spice, and the long
          memory of the Imperium.
        </p>

        <button
          onClick={onStart}
          className="font-body mt-14 px-10 py-4 rounded-sm border border-spice/50 text-spice
                     uppercase tracking-[0.3em] text-sm
                     hover:border-spice hover:text-spice-bright hover:shadow-spice-lg
                     focus:outline-none focus:ring-1 focus:ring-spice/60
                     transition duration-300 shadow-spice"
        >
          Begin
        </button>

        <p className="font-body mt-16 text-[11px] tracking-widest text-sand-dim/60 uppercase">
          Answers drawn from the archives, not from memory
        </p>
      </div>
    </div>
  )
}
