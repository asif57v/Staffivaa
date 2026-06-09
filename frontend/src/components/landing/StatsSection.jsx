import { stats } from '../../data/landingContent'
import { AnimatedCounter } from '../ui/AnimatedCounter'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'

export function StatsSection() {
  return (
    <section
      id="stats"
      className="relative overflow-hidden border-y border-emerald-900/30 bg-gradient-to-br from-surface-900 via-surface-950 to-surface-900 py-16 text-white"
      aria-label="Platform statistics"
    >
      <div className="pointer-events-none absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2240%22%20height=%2240%22%3E%3Cpath%20d=%22M0%2040h40V0%22%20fill=%22none%22%20stroke=%22%23ffffff%22%20stroke-opacity=%22.04%22/%3E%3C/svg%3E')]" />
      <Container>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center lg:text-left">
              <div className="text-4xl font-black tracking-tight text-transparent sm:text-5xl bg-gradient-to-r from-brand-bright via-white to-brand-bright bg-clip-text">
                <AnimatedCounter value={s.value} suffix={s.suffix} />
              </div>
              <p className="mt-2 text-sm font-medium text-zinc-400">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
