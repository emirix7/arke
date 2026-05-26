'use client'
import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useReconnect() {
  const { profile, updateProfile } = useAuthStore()
  const reconnectingRef = useRef(false)

  useEffect(() => {
    const handleOnline = async () => {
      if (!profile || reconnectingRef.current) return
      reconnectingRef.current = true
      if (profile.status !== 'invisible') {
        await updateProfile({ status: 'online' })
      }
      // Force reconnect all realtime channels
      try {
        await supabase.realtime.connect()
        // Re-subscribe all channels after reconnect
        supabase.getChannels().forEach(ch => {
          if (ch.state !== 'joined') ch.subscribe()
        })
      } catch {}
      reconnectingRef.current = false
    }

    const handleOffline = () => {
      if (!profile) return
      if (profile.status !== 'invisible') updateProfile({ status: 'offline' })
    }

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        await handleOnline()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Heartbeat every 2 min - keep realtime alive
    const heartbeat = setInterval(async () => {
      if (!navigator.onLine || !profile) return
      if (profile.status !== 'invisible') {
        updateProfile({ status: 'online', updated_at: new Date().toISOString() } as any)
      }
      // Check realtime health and reconnect if needed
      const channels = supabase.getChannels()
      const hasDisconnected = channels.some(ch => ch.state === 'errored' || ch.state === 'closed')
      if (hasDisconnected) {
        try { await supabase.realtime.connect() } catch {}
        channels.forEach(ch => { if (ch.state !== 'joined') ch.subscribe() })
      }
    }, 2 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(heartbeat)
    }
  }, [profile?.id])
}
