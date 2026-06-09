import { Reveal } from './Reveal'

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  dark = false,
  titleId,
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : ''

  return (
    <div className={`mb-10 max-w-3xl space-y-3 md:mb-14 ${alignCls}`}>
      {eyebrow ? (
        <Reveal>
          <p
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              dark ? 'text-brand-bright/95' : 'text-brand'
            }`}
          >
            {eyebrow}
          </p>
        </Reveal>
      ) : null}
      <Reveal delay={0.05}>
        <h2
          id={titleId}
          className={`text-3xl font-extrabold tracking-tight sm:text-4xl md:text-[2.5rem] ${
            dark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {title}
        </h2>
      </Reveal>
      {subtitle ? (
        <Reveal delay={0.1}>
          <p
            className={`text-base leading-relaxed md:text-lg ${
              dark ? 'text-zinc-400' : 'text-slate-600'
            }`}
          >
            {subtitle}
          </p>
        </Reveal>
      ) : null}
    </div>
  )
}
