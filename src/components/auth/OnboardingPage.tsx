'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Users, Server, ArrowRight, Check } from 'lucide-react'

interface OnboardingPageProps {
  onComplete: () => void
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const { profile } = useAuthStore()
  const [step, setStep] = useState(0)
  const [friendUsername, setFriendUsername] = useState('')
  const [friendResult, setFriendResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [serverName, setServerName] = useState('')
  const [serverCreated, setServerCreated] = useState(false)

  const steps = [
    { title: 'Hoş geldin!', subtitle: `Merhaba ${profile?.username} 👋` },
    { title: 'Arkadaş Ekle', subtitle: 'Kullanıcı adıyla arkadaşlarını bul' },
    { title: 'Sunucu Oluştur', subtitle: 'Topluluğunu kur veya birlikte oyna' },
  ]

  const sendFriendRequest = async () => {
    if (!friendUsername.trim() || !profile) return
    const { data: target } = await supabase.from('profiles').select('id, username').eq('username', friendUsername.trim().toLowerCase()).single()
    if (!target) { setFriendResult('error'); return }
    await supabase.from('friendships').insert({ sender_id: profile.id, receiver_id: target.id, status: 'pending' })
    setFriendResult('success')
  }

  const createServer = async () => {
    if (!serverName.trim() || !profile) return
    const { data: server } = await (supabase.from('servers') as any).insert({ name: serverName.trim(), owner_id: profile.id }).select().single()
    if (server) {
      await supabase.from('server_members').insert({ server_id: server.id, user_id: profile.id, role: 'admin' })
      await supabase.from('channels').insert([
        { server_id: server.id, name: 'genel', type: 'text', position: 0 },
        { server_id: server.id, name: 'Sesli Genel', type: 'voice', position: 1 },
      ])
      setServerCreated(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(192,68,255,0.06) 0%, transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md mx-4">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
                style={{
                  background: i < step ? '#3dff9a' : i === step ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.08)',
                  color: i <= step ? 'white' : 'rgba(255,255,255,0.3)',
                }}>
                {i < step ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className="w-12 h-0.5 transition-all duration-300"
                  style={{ background: i < step ? '#3dff9a' : 'rgba(255,255,255,0.08)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-7" style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-syne font-black text-2xl mb-1" style={{ color: '#f0eeff' }}>{steps[step].title}</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>{steps[step].subtitle}</p>

          {/* Step 0 - Welcome */}
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(192,68,255,0.15)' }}>
                  <Users size={18} strokeWidth={1.75} style={{ color: '#c044ff' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#e8e6f0' }}>Arkadaşlarını ekle</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Kullanıcı adıyla ara ve mesajlaş</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,212,255,0.15)' }}>
                  <Server size={18} strokeWidth={1.75} style={{ color: '#00d4ff' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#e8e6f0' }}>Sunucu oluştur</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Topluluğunu kur, arkadaşlarını davet et</p>
                </div>
              </div>
              <button onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 mt-2"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                Başla <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          )}

          {/* Step 1 - Add Friend */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <input value={friendUsername} onChange={e => { setFriendUsername(e.target.value); setFriendResult('idle') }}
                placeholder="kullanici_adi" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${friendResult === 'error' ? 'rgba(255,107,157,0.4)' : friendResult === 'success' ? 'rgba(61,255,154,0.4)' : 'rgba(255,255,255,0.08)'}`, color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
                onKeyDown={e => e.key === 'Enter' && sendFriendRequest()} />
              {friendResult === 'error' && <p className="text-xs" style={{ color: '#ff6b9d' }}>Kullanıcı bulunamadı.</p>}
              {friendResult === 'success' && <p className="text-xs" style={{ color: '#3dff9a' }}>İstek gönderildi! ✓</p>}
              <button onClick={sendFriendRequest} disabled={!friendUsername.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                İstek Gönder
              </button>
              <button onClick={() => setStep(2)} className="w-full py-2 text-sm"
                style={{ color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Şimdilik geç →
              </button>
            </div>
          )}

          {/* Step 2 - Create Server */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {!serverCreated ? (
                <>
                  <input value={serverName} onChange={e => setServerName(e.target.value)}
                    placeholder="Sunucu adı..." className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
                    onKeyDown={e => e.key === 'Enter' && createServer()} />
                  <button onClick={createServer} disabled={!serverName.trim()}
                    className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                    style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                    Sunucu Oluştur
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(61,255,154,0.08)', border: '1px solid rgba(61,255,154,0.2)' }}>
                  <Check size={20} strokeWidth={2.5} style={{ color: '#3dff9a', flexShrink: 0 }} />
                  <p className="text-sm" style={{ color: '#3dff9a' }}>"{serverName}" sunucusu oluşturuldu!</p>
                </div>
              )}
              <button onClick={onComplete}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                style={{ background: serverCreated ? 'linear-gradient(135deg, #3dff9a, #00d4ff)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: serverCreated ? '#0d0d14' : 'rgba(255,255,255,0.5)' }}>
                {serverCreated ? <>Arke\'ye Gir <ArrowRight size={16} strokeWidth={2} /></> : 'Şimdilik geç →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
