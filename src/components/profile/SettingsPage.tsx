'use client'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { Check, AlertCircle, Bell, BellOff, UserX, ShieldOff } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'

export default function SettingsPage() {
  const { profile, updateProfile } = useAuthStore()
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [customStatus, setCustomStatus] = useState(profile?.custom_status ?? '')
  const [msgPerm, setMsgPerm] = useState<'everyone' | 'friends'>(profile?.allow_messages_from ?? 'everyone')
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const { permission, subscribed, requestPermission, unsubscribe } = usePushNotifications()
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('arke_sound') !== 'off'
    return true
  })

  const toggleSound = () => {
    const newVal = !soundEnabled
    setSoundEnabled(newVal)
    localStorage.setItem('arke_sound', newVal ? 'on' : 'off')
  }
  const [blockedUsers, setBlockedUsers] = useState<any[]>([])
  const [loadingBlocked, setLoadingBlocked] = useState(false)

  useEffect(() => {
    if (!profile) return
    setLoadingBlocked(true)
    ;(supabase as any).from('blocks')
      .select('id, blocked_id, profile:profiles!blocks_blocked_id_fkey(username, avatar_url)')
      .eq('blocker_id', profile.id)
      .then(({ data }: any) => {
        setBlockedUsers(data ?? [])
        setLoadingBlocked(false)
      })
  }, [profile?.id])

  const unblockUser = async (blockId: string) => {
    await (supabase as any).from('blocks').delete().eq('id', blockId)
    setBlockedUsers(prev => prev.filter(b => b.id !== blockId))
  }
  const [saving, setSaving] = useState(false)
  const [activity, setActivity] = useState((profile as any)?.activity ?? '')
  const [activityEmoji, setActivityEmoji] = useState((profile as any)?.activity_emoji ?? '🎮')
  const [pttKey, setPttKey] = useState(typeof window !== 'undefined' ? localStorage.getItem('arke_ptt_key') || 'v' : 'v')
  const [recordingPtt, setRecordingPtt] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File, bucket: string, path: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) return null
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !profile) return
    setAvatarUploading(true)
    const url = await uploadFile(file, 'avatars', `${profile.id}/avatar.${file.name.split('.').pop()}`)
    if (url) await updateProfile({ avatar_url: url })
    setAvatarUploading(false)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !profile) return
    setBannerUploading(true)
    const url = await uploadFile(file, 'banners', `${profile.id}/banner.${file.name.split('.').pop()}`)
    if (url) await updateProfile({ banner_url: url })
    setBannerUploading(false)
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || !profile) return
    setUsernameError(''); setUsernameSuccess(false)
    const clean = newUsername.trim().toLowerCase()
    if (!/^[a-z0-9._]+$/.test(clean)) { setUsernameError('Sadece harf, rakam, nokta ve alt çizgi kullanabilirsin.'); return }
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', clean).single()
    if (existing) { setUsernameError('Bu kullanıcı adı alınmış.'); return }
    await updateProfile({ username: clean, display_name: clean })
    setUsernameSuccess(true)
    setNewUsername('')
    setTimeout(() => setUsernameSuccess(false), 3000)
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) return
    if (newPassword.length < 8) { setPwError('Yeni şifre en az 8 karakter olmalı.'); return }
    setPwError(''); setPwSuccess(false)
    const fakeEmail = `${profile?.username}@arke.app`
    // Verify current password by signing in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: currentPassword })
    if (verifyErr) { setPwError('Mevcut şifre hatalı.'); return }
    // Update password
    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword })
    if (updateErr) { setPwError('Şifre güncellenemedi.'); return }
    setPwSuccess(true)
    setCurrentPassword('')
    setNewPassword('')
    setTimeout(() => setPwSuccess(false), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ bio, display_name: displayName, custom_status: customStatus, allow_messages_from: msgPerm, activity: activity || null, activity_emoji: activityEmoji } as any)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  const initials = (profile?.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0d0d14', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '32px 32px 16px' }}>
          <h1 className="font-syne font-black text-2xl mb-5" style={{ color: '#f0eeff' }}>Profil Ayarları</h1>

          {/* Banner */}
          <div style={{ borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 110, cursor: 'pointer', position: 'relative' }}
            onClick={() => bannerRef.current?.click()}>
            {profile?.banner_url
              ? <img src={profile.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, rgba(192,68,255,0.1), rgba(0,212,255,0.08))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{bannerUploading ? 'Yükleniyor...' : 'Banner ekle (resim veya GIF)'}</span>
                </div>}
            <input ref={bannerRef} type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={handleBannerUpload} />
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 20, marginTop: -36, paddingLeft: 16 }}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => avatarRef.current?.click()}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', border: '4px solid #0d0d14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white' }}>
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
              </div>
              <input ref={avatarRef} type="file" accept="image/*,.gif" style={{ display: 'none' }} onChange={handleAvatarUpload} />
            </div>
            <div style={{ paddingBottom: 4 }}>
              <p className="font-syne font-bold" style={{ color: '#f0eeff' }}>@{profile?.username}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{avatarUploading ? 'Yükleniyor...' : 'Fotoğraf veya GIF için tıkla'}</p>
            </div>
          </div>

          {/* Username change */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <Field label="Kullanıcı Adını Değiştir">
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newUsername} onChange={e => { setNewUsername(e.target.value); setUsernameError('') }}
                  placeholder={`Mevcut: ${profile?.username}`} maxLength={24}
                  className="arke-input" style={{ flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && handleChangeUsername()} />
                <button onClick={handleChangeUsername} disabled={!newUsername.trim()}
                  style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: newUsername.trim() ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.05)', color: newUsername.trim() ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', cursor: newUsername.trim() ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
                  Değiştir
                </button>
              </div>
              {usernameError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <AlertCircle size={12} strokeWidth={2} style={{ color: '#ff6b9d' }} />
                  <p style={{ fontSize: 11, color: '#ff6b9d' }}>{usernameError}</p>
                </div>
              )}
              {usernameSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Check size={12} strokeWidth={2.5} style={{ color: '#3dff9a' }} />
                  <p style={{ fontSize: 11, color: '#3dff9a' }}>Kullanıcı adı güncellendi!</p>
                </div>
              )}
            </Field>
          </div>

          {/* Password change */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <Field label="Şifre Değiştir">
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => { setCurrentPassword(e.target.value); setPwError('') }}
                  placeholder="Mevcut şifre"
                  className="arke-input"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                  {showCurrentPw ? '🙈' : '👁️'}
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setPwError('') }}
                  placeholder="Yeni şifre (min 8 karakter)"
                  className="arke-input"
                  style={{ paddingRight: 40 }}
                  onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(p => !p)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                  {showNewPw ? '🙈' : '👁️'}
                </button>
              </div>
              {pwError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <AlertCircle size={12} strokeWidth={2} style={{ color: '#ff6b9d' }} />
                  <p style={{ fontSize: 11, color: '#ff6b9d' }}>{pwError}</p>
                </div>
              )}
              {pwSuccess && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Check size={12} strokeWidth={2.5} style={{ color: '#3dff9a' }} />
                  <p style={{ fontSize: 11, color: '#3dff9a' }}>Şifre güncellendi!</p>
                </div>
              )}
              <button
                onClick={handleChangePassword}
                disabled={!currentPassword || !newPassword}
                style={{ marginTop: 10, width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 13, fontWeight: 600, background: (currentPassword && newPassword) ? 'linear-gradient(135deg, #c044ff, #00d4ff)' : 'rgba(255,255,255,0.05)', color: (currentPassword && newPassword) ? 'white' : 'rgba(255,255,255,0.3)', border: 'none', cursor: (currentPassword && newPassword) ? 'pointer' : 'not-allowed' }}>
                Şifreyi Güncelle
              </button>
            </Field>
          </div>

          {/* Blocked Users */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              Engellenen Kullanıcılar
            </p>
            {loadingBlocked ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Yükleniyor...</p>
            ) : blockedUsers.length === 0 ? (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Engellenen kullanıcı yok.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {blockedUsers.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {b.profile?.avatar_url
                        ? <img src={b.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (b.profile?.username ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: '#e8e6f0' }}>{b.profile?.username ?? 'Bilinmeyen'}</span>
                    <button
                      onClick={() => unblockUser(b.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'rgba(61,255,154,0.1)', border: '1px solid rgba(61,255,154,0.2)', color: '#3dff9a', cursor: 'pointer' }}>
                      <ShieldOff size={11} strokeWidth={2} /> Engeli Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sound Settings */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <Field label="Bildirim Sesi">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: '#e8e6f0', marginBottom: 3 }}>Mesaj ve bildirim sesleri</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{soundEnabled ? 'Sesler açık' : 'Sesler kapalı'}</p>
                </div>
                <button onClick={toggleSound}
                  style={{ padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, flexShrink: 0, cursor: 'pointer', border: 'none',
                    background: soundEnabled ? 'rgba(61,255,154,0.12)' : 'rgba(255,255,255,0.06)',
                    color: soundEnabled ? '#3dff9a' : 'rgba(255,255,255,0.4)' }}>
                  {soundEnabled ? '🔊 Açık' : '🔇 Kapalı'}
                </button>
              </div>
            </Field>
          </div>

          {/* Push Notifications */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <Field label="Bildirimler">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 13, color: '#e8e6f0', marginBottom: 3 }}>
                    {subscribed ? 'Bildirimler açık' : 'Uygulama kapalıyken bildirim al'}
                  </p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                    {permission === 'denied' ? 'Tarayıcı bildirimlere izin vermedi. Tarayıcı ayarlarından etkinleştir.' :
                     subscribed ? 'Mesaj geldiğinde bildirim alacaksın' : 'Masaüstü bildirimleri etkinleştir'}
                  </p>
                </div>
                <button
                  onClick={() => subscribed ? unsubscribe() : requestPermission()}
                  disabled={permission === 'denied'}
                  style={{
                    padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                    background: subscribed ? 'rgba(255,107,157,0.12)' : 'linear-gradient(135deg, #c044ff, #00d4ff)',
                    border: subscribed ? '1px solid rgba(255,107,157,0.25)' : 'none',
                    color: subscribed ? '#ff6b9d' : 'white',
                    cursor: permission === 'denied' ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                    opacity: permission === 'denied' ? 0.5 : 1,
                  }}>
                  {subscribed
                    ? <><BellOff size={13} strokeWidth={2} /> Kapat</>
                    : <><Bell size={13} strokeWidth={2} /> Etkinleştir</>}
                </button>
              </div>
            </Field>
          </div>

          {/* PTT Settings */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, marginBottom: 12 }}>
            <Field label="Bas-Konuş Tuşu">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${recordingPtt ? 'rgba(192,68,255,0.5)' : 'rgba(255,255,255,0.08)'}`, color: recordingPtt ? '#c044ff' : '#e8e6f0', fontSize: 14, textAlign: 'center', fontWeight: 600 }}>
                  {recordingPtt ? 'Bir tuşa bas...' : pttKey.toUpperCase()}
                </div>
                <button
                  onClick={() => {
                    setRecordingPtt(true)
                    const handler = (e: KeyboardEvent) => {
                      e.preventDefault()
                      setPttKey(e.key.toLowerCase())
                      localStorage.setItem('arke_ptt_key', e.key.toLowerCase())
                      setRecordingPtt(false)
                      window.removeEventListener('keydown', handler)
                    }
                    window.addEventListener('keydown', handler)
                  }}
                  style={{ padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, background: 'rgba(192,68,255,0.12)', border: '1px solid rgba(192,68,255,0.25)', color: '#c044ff', cursor: 'pointer', flexShrink: 0 }}>
                  {recordingPtt ? 'İptal' : 'Değiştir'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>Sesli kanalda Bas-Konuş modunu aktif edince bu tuşa basılı tut</p>
            </Field>
          </div>

          {/* Profile form */}
          <div style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Görünen Ad">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={profile?.username} maxLength={32} className="arke-input" />
            </Field>
            <Field label="Özel Durum">
              <input value={customStatus} onChange={e => setCustomStatus(e.target.value)} placeholder="ne yapıyorsun?" maxLength={64} className="arke-input" />
            </Field>
            <Field label="Aktivite Durumu">
              <div style={{ display: 'flex', gap: 8 }}>
                <select value={activityEmoji} onChange={e => setActivityEmoji(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#e8e6f0', fontSize: 18, cursor: 'pointer', outline: 'none' }}>
                  {['🎮','🎵','📺','📚','💻','🏃','🎨','🍕','😴','✈️'].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <input value={activity} onChange={e => setActivity(e.target.value)}
                  placeholder="ne yapıyorsun? (Valorant oynuyor...)" maxLength={64}
                  className="arke-input" style={{ flex: 1 }} />
              </div>
            </Field>

            <Field label="Biyografi">
              <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Kendinden bahset..." maxLength={190} rows={3} className="arke-input" style={{ resize: 'none' }} />
            </Field>
            <Field label="Kimler Mesaj Atabilir?">
              <div style={{ display: 'flex', gap: 8 }}>
                {(['everyone', 'friends'] as const).map(opt => (
                  <button key={opt} onClick={() => setMsgPerm(opt)} style={{
                    flex: 1, padding: '8px 0', borderRadius: 12, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    background: msgPerm === opt ? 'rgba(192,68,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${msgPerm === opt ? 'rgba(192,68,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    color: msgPerm === opt ? '#c044ff' : 'rgba(255,255,255,0.4)',
                  }}>
                    {opt === 'everyone' ? 'Herkes' : 'Sadece Arkadaşlar'}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0, padding: '12px 32px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d0d14' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <button onClick={handleSave} disabled={saving} style={{
            width: '100%', padding: '12px 0', borderRadius: 12, fontWeight: 600, fontSize: 14,
            color: saved ? '#0d0d14' : 'white', cursor: 'pointer', border: 'none',
            background: saved ? '#3dff9a' : saving ? 'rgba(192,68,255,0.3)' : 'linear-gradient(135deg, #c044ff, #00d4ff)',
          }}>
            {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      <style>{`
        .arke-input { width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 10px 14px; color: #e8e6f0; font-family: DM Sans, sans-serif; font-size: 14px; outline: none; box-sizing: border-box; }
        .arke-input:focus { border-color: rgba(192,68,255,0.5); }
        .arke-input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{label}</label>
      {children}
    </div>
  )
}
