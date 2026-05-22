'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import AuthPage from '@/components/auth/AuthPage'
import AppShell from '@/components/layout/AppShell'

export default function Home() {
  const { user, setUser, setLoading, fetchProfile, loading } = useAuthStore()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchProfile(session.user.id)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Update presence on load
  useEffect(() => {
    const { profile, updateProfile } = useAuthStore.getState()
    if (profile) {
      updateProfile({ status: 'online' })
    }

    const handleUnload = () => {
      const { profile: p, updateProfile: up } = useAuthStore.getState()
      if (p) up({ status: 'offline' })
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [user])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff, #ff6b9d)' }}
          >
            <span className="font-syne font-black text-xl text-white">A</span>
          </div>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'rgba(192,68,255,0.3)', borderTopColor: '#c044ff' }} />
        </div>
      </div>
    )
  }

  if (!user) return <AuthPage />
  return <AppShell />
}
