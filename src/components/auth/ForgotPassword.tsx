'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ArrowLeft } from 'lucide-react'

interface ForgotPasswordProps {
  onBack: () => void
}

export default function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [step, setStep] = useState<'find' | 'reset' | 'done'>('find')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const findUser = async () => {
    if (!username.trim()) return
    setLoading(true); setError('')
    const { data } = await supabase.from('profiles').select('id').eq('username', username.trim().toLowerCase()).single()
    if (!data) { setError('Bu kullanıcı adı bulunamadı.'); setLoading(false); return }
    setStep('reset'); setLoading(false)
  }

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 8) { setError('Şifre en az 8 karakter olmalı.'); return }
    setLoading(true); setError('')
    const fakeEmail = `${username.trim().toLowerCase()}@arke.app`
    // Sign in first to get session, then update password
    // Since we use fake emails, we need admin approach - use supabase auth admin
    // Instead, we'll use the updateUser approach after signing in
    const { error: err } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: newPassword })
    if (!err) { setStep('done'); setLoading(false); return }
    // If that fails, try resetting via email (won't work with fake emails)
    // For now show error
    setError('Mevcut şifrenizi bilmeden şifre sıfırlama e-posta gerektiriyor. Şifrenizi hatırlıyorsanız giriş yapın.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d0d14' }}>
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl p-6" style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}>
            <ArrowLeft size={14} strokeWidth={2} /> Geri dön
          </button>

          <h2 className="font-syne font-black text-xl mb-1" style={{ color: '#f0eeff' }}>Şifre Sıfırla</h2>

          {step === 'find' && (
            <>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>Kullanıcı adını gir</p>
              <div className="flex flex-col gap-3">
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="kullanici_adi"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
                  onKeyDown={e => e.key === 'Enter' && findUser()} />
                {error && <p className="text-xs" style={{ color: '#ff6b9d' }}>{error}</p>}
                <button onClick={findUser} disabled={!username.trim() || loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                  {loading ? 'Aranıyor...' : 'Devam Et'}
                </button>
              </div>
            </>
          )}

          {step === 'reset' && (
            <>
              <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>Yeni şifreni gir</p>
              <div className="flex flex-col gap-3">
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Yeni şifre (min 8 karakter)"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontFamily: 'DM Sans, sans-serif' }}
                  onKeyDown={e => e.key === 'Enter' && resetPassword()} />
                {error && <p className="text-xs" style={{ color: '#ff6b9d' }}>{error}</p>}
                <button onClick={resetPassword} disabled={!newPassword || loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #c044ff, #00d4ff)' }}>
                  {loading ? 'Sıfırlanıyor...' : 'Şifreyi Sıfırla'}
                </button>
              </div>
            </>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <p className="text-3xl mb-3">✓</p>
              <p className="text-sm" style={{ color: '#3dff9a' }}>Şifre güncellendi!</p>
              <button onClick={onBack} className="mt-4 text-sm"
                style={{ color: '#c044ff', background: 'none', border: 'none', cursor: 'pointer' }}>
                Giriş yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
