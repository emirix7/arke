'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import AuthPage from '@/components/auth/AuthPage'
import AppShell from '@/components/layout/AppShell'
import OnboardingPage from '@/components/auth/OnboardingPage'
import ErrorBoundary from '@/components/ui/ErrorBoundary'

const ONBOARDING_KEY = 'arke_onboarding_done'

export default function Home() {
  const { user, setUser, setLoading, fetchProfile, loading, profile } = useAuthStore()
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
        // Show onboarding only for brand new signups, only once
        if (event === 'SIGNED_IN') {
          const done = localStorage.getItem(ONBOARDING_KEY)
          if (!done) setShowOnboarding(true)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (profile) {
      useAuthStore.getState().updateProfile({ status: 'online' })
    }
    const handleUnload = () => {
      const { profile: p, updateProfile } = useAuthStore.getState()
      if (p) updateProfile({ status: 'offline' })
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [user])

  const handleOnboardingComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, '1')
    setShowOnboarding(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
        <div className="flex flex-col items-center gap-4">
          <img src="/arke-logo.png" alt="Arke" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
          <div className="w-6 h-6 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(192,68,255,0.3)', borderTopColor: '#c044ff' }} />
        </div>
      </div>
    )
  }

  if (!user) return <AuthPage />
  if (showOnboarding) return <OnboardingPage onComplete={handleOnboardingComplete} />

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  )
}
