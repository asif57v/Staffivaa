import { Helmet } from 'react-helmet-async'
import { SITE } from '../../data/landingContent'

const description =
  'Hire Aadhaar-verified masons, electricians, plumbers, helpers & more—instant booking, transparent pricing, and secure digital payments across Indian cities. Register as labour to get nearby jobs.'

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  url: SITE.url,
  description,
  logo: `${SITE.url}/favicon.svg`,
  sameAs: [
    'https://www.linkedin.com/company/labourchowck',
    'https://twitter.com/labourchowck',
    'https://www.instagram.com/labourchowck',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: SITE.phone,
    contactType: 'customer support',
    areaServed: 'IN',
    availableLanguage: ['English', 'Hindi'],
  },
}

const serviceSchema = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: `${SITE.name} On-demand Construction Labour`,
  provider: { '@type': 'Organization', name: SITE.name, url: SITE.url },
  areaServed: { '@type': 'Country', name: 'India' },
  serviceType: 'Construction labour hiring and workforce matching',
  description,
}

export function SEOMeta() {
  return (
    <Helmet>
      <html lang="en" />
      <title>Staffivaa — Book Trusted Construction Labour in Minutes</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={SITE.url} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content="Staffivaa — Book Trusted Construction Labour in Minutes" />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={SITE.url} />
      <meta property="og:image" content={`${SITE.url}/og-labourchowck.png`} />
      <meta property="og:locale" content="en_IN" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Staffivaa — Verified construction labour, on demand" />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${SITE.url}/og-labourchowck.png`} />

      <script type="application/ld+json">{JSON.stringify(schema)}</script>
      <script type="application/ld+json">{JSON.stringify(serviceSchema)}</script>
    </Helmet>
  )
}
