'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function SettingsPage() {
  const { profile, updateProfile } = useAuthStore()
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [customStatus, setCustomStatus] = useState(profile?.custom_status ?? '')
  const [msgPerm, setMsgPerm] = useState<'everyone' | 'friends'>(profile?.allow_messages_from ?? 'everyone')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string | null> => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) { console.error(error); return null }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return data.publicUrl
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setAvatarUploading(true)
    const ext = file.name.split('.').pop()
    const url = await uploadFile(file, 'avatars', `${profile.id}/avatar.${ext}`)
    if (url) await updateProfile({ avatar_url: url })
    setAvatarUploading(false)
  }

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setBannerUploading(true)
    const ext = file.name.split('.').pop()
    const url = await uploadFile(file, 'banners', `${profile.id}/banner.${ext}`)
    if (url) await updateProfile({ banner_url: url })
    setBannerUploading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ bio, display_name: displayName, custom_status: customStatus, allow_messages_from: msgPerm })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const initials = (profile?.username ?? '?').slice(0, 2).toUpperCase()

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: '#0d0d14' }}>
      <div className="max-w-xl mx-auto px-8 py-8">
        <h1 className="font-syne font-black text-2xl mb-6" style={{ color: '#f0eeff' }}>Profil Ayarları</h1>

        {/* Banner */}
        <div className="rounded-2xl overflow-hidden mb-4 relative group cursor-pointer"
          style={{ height: 120, background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}
          onClick={() => bannerRef.current?.click()}>
          {profile?.banner_url
            ? <img src={profile.banner_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(192,68,255,0.1), rgba(0,212,255,0.08))' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Banner ekle (resim veya GIF)</p>
              </div>}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <span className="text-sm font-medium" style={{ color: 'white' }}>
              {bannerUploading ? 'Yükleniyor...' : '📷 Banner Değiştir'}
            </span>
          </div>
          <input ref={bannerRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleBannerUpload} />
        </div>

        {/* Avatar */}
        <div className="flex items-end gap-4 mb-6 -mt-8 px-4">
          <div className="relative group cursor-pointer" onClick={() => avatarRef.current?.click()}>
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center font-bold text-2xl text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', border: '4px solid #0d0d14' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                : initials}
            </div>
            <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              <span style={{ fontSize: 20 }}>{avatarUploading ? '⏳' : '📷'}</span>
            </div>
            <input ref={avatarRef} type="file" accept="image/*,.gif" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="pb-1">
            <p className="font-syne font-bold" style={{ color: '#f0eeff' }}>{profile?.username}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Profil fotoğrafını veya GIF'ini değiştirmek için tıkla</p>
          </div>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 rounded-2xl p-5"
          style={{ background: '#10101c', border: '1px solid rgba(255,255,255,0.07)' }}>

          <Field label="Görünen Ad">
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder={profile?.username} maxLength={32} className="arke-input" />
          </Field>

          <Field label="Özel Durum">
            <input value={customStatus} onChange={e => setCustomStatus(e.target.value)}
              placeholder="ne yapıyorsun?" maxLength={64} className="arke-input" />
          </Field>

          <Field label="Biyografi">
            <textarea value={bio} onChange={e => setBio(e.target.value)}
              placeholder="Kendinden bahset..." maxLength={190} rows={3}
              className="arke-input resize-none" />
          </Field>

          <Field label="Kimler Mesaj Atabilir?">
            <div className="flex gap-2">
              {(['everyone', 'friends'] as const).map(opt => (
                <button key={opt} onClick={() => setMsgPerm(opt)}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    background: msgPerm === opt ? 'rgba(192,68,255,0.15)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${msgPerm === opt ? 'rgba(192,68,255,0.3)' : 'rgba(255,255,255,0.07)'}`,
                    color: msgPerm === opt ? '#c044ff' : 'rgba(255,255,255,0.4)',
                  }}>
                  {opt === 'everyone' ? 'Herkes' : 'Sadece Arkadaşlar'}
                </button>
              ))}
            </div>
          </Field>

          <button onClick={handleSave} disabled={saving}
            className="py-3 rounded-xl font-semibold text-sm text-white transition-all duration-150 mt-1"
            style={{ background: saved ? 'rgba(61,255,154,0.3)' : 'linear-gradient(135deg, #c044ff, #00d4ff)', cursor: 'pointer' }}>
            {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
          </button>
        </div>
      </div>

      <style>{`
        .arke-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 10px 14px;
          color: #e8e6f0;
          font-family: DM Sans, sans-serif;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .arke-input:focus { border-color: rgba(192,68,255,0.5); }
        .arke-input::placeholder { color: rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold tracking-widest uppercase"
        style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</label>
      {children}
    </div>
  )
}
