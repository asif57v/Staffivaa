import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { getRoleHomePath } from '../lib/roleHomePath.js'
import { AppPromoSection } from '../components/landing/AppPromoSection'
import { FAQSection } from '../components/landing/FAQSection'
import { FeaturesSection } from '../components/landing/FeaturesSection'
import { FinalCTA } from '../components/landing/FinalCTA'
import { Footer } from '../components/landing/Footer'
import { Hero } from '../components/landing/Hero'
import { HowItWorks } from '../components/landing/HowItWorks'
import { Navbar } from '../components/landing/Navbar'
import { ProblemSection } from '../components/landing/ProblemSection'
import { SEOMeta } from '../components/landing/SEOMeta'
import { ServicesGrid } from '../components/landing/ServicesGrid'
import { SafetySection } from '../components/landing/SafetySection'
import { StatsSection } from '../components/landing/StatsSection'
import { TestimonialsSection } from '../components/landing/TestimonialsSection'
import { UserTypesSection } from '../components/landing/UserTypesSection'
import { PageSkeleton } from '../components/ui/PageSkeleton'

export function LandingPage() {
  const [boot, setBoot] = useState(true)

  useEffect(() => {
    const t = window.setTimeout(() => setBoot(false), 700)
    return () => window.clearTimeout(t)
  }, [])

  const { isAuthenticated, user, loading } = useAuth()

  if (loading) {
    return <PageSkeleton visible={true} />
  }

  if (isAuthenticated && user) {
    return <Navigate to={getRoleHomePath(user.role)} replace />
  }

  return (
    <>
      <SEOMeta />
      <PageSkeleton visible={boot} />
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white mx-auto max-w-[430px]"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <Hero />
        <StatsSection />
        <ServicesGrid />
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
        <UserTypesSection />
        <TestimonialsSection />
        <SafetySection />
        <AppPromoSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
