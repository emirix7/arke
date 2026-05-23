'use client'

// Generate LiveKit token via Supabase Edge Function
// This works in both dev and static export (Tauri) modes
export async function getLiveKitToken(roomName: string, identity: string): Promise<string | null> {
  try {
    // In dev mode, use Next.js API route
    if (process.env.NODE_ENV === 'development') {
      const res = await fetch('/api/livekit-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, identity }),
      })
      if (res.ok) {
        const { token } = await res.json()
        return token
      }
    }

    // In production (Tauri), use Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const res = await fetch(`${supabaseUrl}/functions/v1/livekit-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ roomName, identity }),
    })
    if (res.ok) {
      const { token } = await res.json()
      return token
    }
    return null
  } catch (e) {
    console.error('LiveKit token error:', e)
    return null
  }
}
