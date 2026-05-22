'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { motion, AnimatePresence } from 'framer-motion'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setUser, fetchProfile } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        // Check username uniqueness
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase().trim())
          .single()

        if (existing) {
          setError('Bu kullanıcı adı zaten alınmış.')
          setLoading(false)
          return
        }

        // Create auth user with fake email
        const fakeEmail = `${username.toLowerCase().trim()}@arke.app`
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
        })

        if (signUpError) throw signUpError

        if (data.user) {
          // Create profile
          await (supabase.from('profiles') as any).insert({
            id: data.user.id,
            username: username.toLowerCase().trim(),
            display_name: username.trim(),
            status: 'online',
            allow_messages_from: 'everyone',
            updated_at: new Date().toISOString(),
          })

          setUser(data.user)
          await fetchProfile(data.user.id)
        }
      } else {
        const fakeEmail = `${username.toLowerCase().trim()}@arke.app`
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password,
        })

        if (signInError) {
          setError('Kullanıcı adı veya şifre hatalı.')
          setLoading(false)
          return
        }

        if (data.user) {
          setUser(data.user)
          await fetchProfile(data.user.id)
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d14] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(192,68,255,0.08) 0%, transparent 70%)' }} />
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm mx-4"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #c044ff, #ff6b9d)' }}>
            <span className="font-syne font-black text-2xl text-white">A</span>
          </div>
          <h1 className="font-syne font-black text-3xl text-white tracking-tight">arke</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {mode === 'login' ? 'Tekrar hoş geldin' : 'Aramıza katıl'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6 border"
          style={{ background: '#10101c', borderColor: 'rgba(255,255,255,0.07)' }}>

          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-6"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                style={{
                  background: mode === m ? 'rgba(192,68,255,0.2)' : 'transparent',
                  color: mode === m ? '#c044ff' : 'rgba(255,255,255,0.4)',
                  border: mode === m ? '1px solid rgba(192,68,255,0.3)' : '1px solid transparent',
                }}
              >
                {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="kullanici_adin"
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9._]+"
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e8e6f0',
                  fontFamily: 'DM Sans, sans-serif',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(192,68,255,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
              {mode === 'register' && (
                <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Harfler, rakamlar, nokta ve alt çizgi kullanabilirsin
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold mb-2 tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.35)' }}>
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#e8e6f0',
                  fontFamily: 'DM Sans, sans-serif',
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(192,68,255,0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-4 py-3 text-sm"
                  style={{ background: 'rgba(255,107,157,0.1)', color: '#ff6b9d', border: '1px solid rgba(255,107,157,0.2)' }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 mt-1"
              style={{
                background: loading ? 'rgba(192,68,255,0.3)' : 'linear-gradient(135deg, #c044ff, #00d4ff)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Giriş yapılıyor...' : 'Hesap oluşturuluyor...'}
                </span>
              ) : (
                mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
