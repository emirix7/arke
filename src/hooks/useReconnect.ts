'use client'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export function useReconnect() {
  const { profile, updateProfile } = useAuthStore()

  useEffect(() => {
    const handleOnline = async () => {
      if (!profile) return
      await updateProfile({ status: 'online' })
      // Reconnect all Supabase realtime channels
      await supabase.realtime.connect()
    }

    const handleOffline = () => {
      if (!profile) return
      updateProfile({ status: 'offline' })
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic heartbeat - update status every 5 min to keep online
    const heartbeat = setInterval(() => {
      if (navigator.onLine && profile) {
        updateProfile({ status: 'online', updated_at: new Date().toISOString() } as any)
      }
    }, 5 * 60 * 1000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(heartbeat)
    }
  }, [profile?.id])
}
