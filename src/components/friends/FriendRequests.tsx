'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useFriendRequests } from '@/hooks/useFriends'

export default function FriendRequests() {
  const { profile } = useAuthStore()
  const { pending, sent, friends, refetch } = useFriendRequests()
  const [addUsername, setAddUsername] = useState('')
  const [addError, setAddError] = useState('')
  const [addSuccess, setAddSuccess] = useState('')
  const [addLoading, setAddLoading] = useState(false)

  const sendRequest = async () => {
    if (!addUsername.trim() || !profile) return
    setAddError('')
    setAddSuccess('')
    setAddLoading(true)

    const username = addUsername.toLowerCase().trim()
    if (username === profile.username) {
      setAddError('Kendine arkadaşlık isteği gönderemezsin.')
      setAddLoading(false)
      return
    }

    const { data: target } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .single()

    if (!target) {
      setAddError('Bu kullanıcı bulunamadı.')
      setAddLoading(false)
      return
    }

    const { error } = await supabase.from('friendships').insert({
      sender_id: profile.id,
      receiver_id: target.id,
      status: 'pending',
    })

    if (error) {
      setAddError('İstek zaten gönderilmiş veya bir hata oluştu.')
    } else {
      setAddSuccess(`${target.username} kişisine istek gönderildi!`)
      setAddUsername('')
      refetch()
    }
    setAddLoading(false)
  }

  const acceptRequest = async (friendshipId: string, senderId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    // Create conversation
    await supabase.from('conversations').insert({
      participant_1: profile!.id,
      participant_2: senderId,
    })
    refetch()
  }

  const declineRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    refetch()
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0d0d14' }}>
      <div className="max-w-2xl mx-auto px-8 py-8">
        <h1 className="font-syne font-black text-2xl mb-6" style={{ color: '#f0eeff' }}>
          Arkadaşlar
        </h1>

        {/* Add friend */}
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'rgba(255,255,255,0.35)' }}>
            Arkadaş Ekle
          </p>
          <div className="flex gap-3">
            <input
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#e8e6f0',
                fontFamily: 'DM Sans, sans-serif',
              }}
              placeholder="kullanici_adi"
              value={addUsername}
              onChange={(e) => setAddUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
              onFocus={(e) => (e.target as HTMLElement).style.borderColor = 'rgba(192,68,255,0.5)'}
              onBlur={(e) => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'}
            />
            <button
              onClick={sendRequest}
              disabled={addLoading || !addUsername.trim()}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-150"
              style={{
                background: addUsername.trim() ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.05)',
                cursor: addUsername.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {addLoading ? '...' : 'Gönder'}
            </button>
          </div>
          {addError && <p className="text-xs mt-2" style={{ color: '#ff6b9d' }}>{addError}</p>}
          {addSuccess && <p className="text-xs mt-2" style={{ color: '#3dff9a' }}>{addSuccess}</p>}
        </div>

        {/* Pending incoming */}
        {pending.length > 0 && (
          <section className="mb-6">
            <p className="text-xs font-semibold tracking-widest uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.3)' }}>
              Bekleyen İstekler — {pending.length}
            </p>
            <div className="flex flex-col gap-2">
              {pending.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                    {f.profile.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#e8e6f0' }}>{f.profile.username}</p>
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Arkadaşlık isteği gönderdi</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acceptRequest(f.id, f.profile.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(61,255,154,0.1)', color: '#3dff9a', border: '1px solid rgba(61,255,154,0.2)' }}
                    >
                      Kabul
                    </button>
                    <button
                      onClick={() => declineRequest(f.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ background: 'rgba(255,107,157,0.08)', color: '#ff6b9d', border: '1px solid rgba(255,107,157,0.15)' }}
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Friends list */}
        <section>
          <p className="text-xs font-semibold tracking-widest uppercase mb-3"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            Arkadaşlar — {friends.length}
          </p>
          {friends.length === 0 ? (
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Henüz arkadaşın yok. Yukarıdan ekle!
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {friends.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)' }}>
                    {f.profile.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#e8e6f0' }}>{f.profile.username}</p>
                    <p className="text-xs" style={{ color: f.profile.status === 'online' ? '#3dff9a' : 'rgba(255,255,255,0.3)' }}>
                      {f.profile.status === 'online' ? '● Çevrimiçi' : 'Çevrimdışı'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
