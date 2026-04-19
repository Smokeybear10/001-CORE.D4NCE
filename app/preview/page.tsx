import Link from "next/link"

const VARIANTS = [
  {
    slug: "a",
    name: "Live Deck",
    tag: "full-bleed animation",
    blurb:
      "Existing animation stays as the entire backdrop. Glass content layer floats over it with badge, headline, body, CTAs, and stats. Most cinematic — feels like Stripe homepage in a dark room.",
    refs: "Stripe · Linear · Vercel hero",
  },
  {
    slug: "b",
    name: "Mixer Console",
    tag: "HarborOS mirror",
    blurb:
      "Two-column hero. Left: marketing copy + stats. Right: animated mini-deck mockup with two scrolling waveforms, crossfader, and an AI suggestion bubble. Most YC SaaS — direct port of the HarborOS structure.",
    refs: "HarborOS · Linear · Notion · Raycast",
  },
  {
    slug: "c",
    name: "Studio Tape",
    tag: "Vercel/Resend minimal",
    blurb:
      "Single column, centered, generous whitespace. Restrained motion. One horizontal 'live transition' strip below the hero with two waveforms blending and AI text typing. Most premium and quiet.",
    refs: "Vercel · Resend · Linear changelog",
  },
] as const

export default function PreviewIndex() {
  return (
    <main className="min-h-dvh bg-[#0d0221] text-slate-200">
      <header className="max-w-[1200px] mx-auto px-8 pt-16 pb-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-[11.5px] text-slate-400 font-mono mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animation: "subtle-pulse 2.4s infinite" }} />
          Hero direction shotgun · 3 concepts
        </div>
        <h1 className="text-[40px] lg:text-[48px] leading-[1.05] tracking-[-0.03em] font-semibold mb-4">
          Pick a direction for the <span className="gradient-text">D4NCE landing</span>.
        </h1>
        <p className="text-[15px] leading-[1.55] text-slate-400 max-w-[640px]">
          Three live concepts, each with the existing canvas animation language. Click any card to see the full-page mockup at 100%. The current landing stays at <code className="font-mono text-violet-300/80">/</code>.
        </p>
      </header>

      <section className="max-w-[1200px] mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-4">
        {VARIANTS.map((v) => (
          <Link
            key={v.slug}
            href={`/preview/${v.slug}`}
            className="group glass rounded-xl p-5 hover:border-violet-400/35 transition-all hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-violet-300/60">
                Variant {v.slug.toUpperCase()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{v.tag}</span>
            </div>
            <h2 className="text-[22px] font-semibold mb-2 group-hover:text-white transition-colors">{v.name}</h2>
            <p className="text-[13px] leading-[1.55] text-slate-400 mb-5">{v.blurb}</p>
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">{v.refs}</span>
              <span className="text-violet-300/70 group-hover:text-violet-200 transition-colors">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </section>

      <footer className="max-w-[1200px] mx-auto px-8 pb-12 text-[11px] text-slate-500 font-mono">
        Pick one and tell me what to keep, lose, or remix. I'll roll it into the real <code className="text-violet-300/70">app/page.tsx</code> landing.
      </footer>
    </main>
  )
}
