'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

// VAPID public key - generate at https://web-push-codelab.glitch.me/
// For now use a placeholder - user needs to generate their own
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

export function usePushNotifications() {
  const { profile } = useAuthStore()
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setPermission(Notification.permission)
    checkSubscription()
  }, [profile?.id])

  const checkSubscription = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch {}
  }

  const requestPermission = async (): Promise<boolean> => {
    if (!('Notification' in window)) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    if (result === 'granted') {
      await subscribe()
      return true
    }
    return false
  }

  const subscribe = async () => {
    if (!profile || !VAPID_PUBLIC_KEY) return
    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      // Save subscription to Supabase
      await supabase.from('push_subscriptions' as any).upsert({
        user_id: profile.id,
        subscription: JSON.stringify(sub),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      setSubscribed(true)
    } catch (e) {
      console.error('Push subscribe error:', e)
    }
  }

  const unsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
      if (profile) await supabase.from('push_subscriptions' as any).delete().eq('user_id', profile.id)
      setSubscribed(false)
    } catch {}
  }

  // Show local notification when app is in background
  const showLocalNotification = (title: string, body: string) => {
    if (Notification.permission !== 'granted') return
    if (document.hasFocus()) return // Don't show if app is focused
    new Notification(title, {
      body,
      icon: '/arke-logo.png',
      badge: '/arke-logo.png',
    })
  }

  return { permission, subscribed, requestPermission, unsubscribe, showLocalNotification }
}
