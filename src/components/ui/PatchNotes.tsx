'use client'
import { useState } from 'react'
import { X, Zap, Shield, Bug, Star } from 'lucide-react'
import PrivacyPolicy from './PrivacyPolicy'

export default function PatchNotes({ onClose }: { onClose: () => void }) {
  const [showPolicy, setShowPolicy] = useState(false)

  const patches = [
    {
      version: '0.1.0',
      date: '24 Mayıs 2026',
      icon: <Star size={14} strokeWidth={2} />,
      color: '#c044ff',
      title: 'İlk Sürüm',
      changes: [
        { type: 'new', text: 'Kullanıcı adı ve şifre ile kayıt/giriş sistemi' },
        { type: 'new', text: 'Arkadaş ekleme ve 1:1 mesajlaşma' },
        { type: 'new', text: 'Gerçek zamanlı mesajlaşma' },
        { type: 'new', text: 'Emoji desteği ve reactions' },
        { type: 'new', text: 'Görüldü sistemi ve mesaj saati' },
        { type: 'new', text: 'Profil fotoğrafı ve banner (GIF destekli)' },
        { type: 'new', text: 'Sesli 1:1 arama (LiveKit)' },
        { type: 'new', text: 'Sunucu oluşturma ve davet sistemi' },
        { type: 'new', text: 'Sunucuda metin ve sesli kanallar' },
        { type: 'new', text: 'Ekran paylaşımı' },
        { type: 'new', text: 'Rol sistemi (Admin, Mod, User)' },
        { type: 'new', text: '@mention sistemi' },
        { type: 'new', text: 'Ses mesajı gönderme' },
        { type: 'new', text: 'Resim ve GIF gönderme' },
        { type: 'new', text: 'Link önizleme ve güvenlik uyarısı' },
        { type: 'new', text: 'Yazıyor... göstergesi' },
        { type: 'new', text: 'Bas-konuş modu' },
        { type: 'new', text: 'Konuşan kişi yeşil çerçeve göstergesi' },
        { type: 'security', text: 'Uçtan uca şifreli kimlik doğrulama' },
        { type: 'security', text: 'Row Level Security ile veri izolasyonu' },
        { type: 'security', text: 'IP adresi gizleme (LiveKit relay)' },
      ]
    }
  ]

  const typeIcon = (type: string) => {
    if (type === 'new') return { icon: <Zap size={11} strokeWidth={2} />, color: '#c044ff', label: 'YENİ' }
    if (type === 'security') return { icon: <Shield size={11} strokeWidth={2} />, color: '#3dff9a', label: 'GÜVENLİK' }
    return { icon: <Bug size={11} strokeWidth={2} />, color: '#ffb347', label: 'DÜZELTME' }
  }

  if (showPolicy) return <PrivacyPolicy onClose={() => setShowPolicy(false)} />

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '85vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <img src="/arke-logo.png" alt="Arke" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            <div>
              <p className="font-syne font-bold" style={{ color: '#f0eeff' }}>Arke</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Yama Notları</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowPolicy(true)}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.45)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#c044ff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'}>
              Gizlilik Politikası
            </button>
            <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Patches */}
        <div className="overflow-y-auto px-6 py-4 flex flex-col gap-6">
          {patches.map(patch => (
            <div key={patch.version}>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: `${patch.color}20`, color: patch.color, border: `1px solid ${patch.color}40` }}>
                  {patch.icon} v{patch.version}
                </div>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{patch.date}</span>
                <span className="font-syne font-semibold text-sm ml-1" style={{ color: '#f0eeff' }}>{patch.title}</span>
              </div>
              <div className="flex flex-col gap-1.5 pl-2">
                {patch.changes.map((change, i) => {
                  const { icon, color, label } = typeIcon(change.type)
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="flex items-center gap-1 text-xs font-semibold flex-shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                        style={{ color, background: `${color}15`, minWidth: 64, justifyContent: 'center' }}>
                        {icon} {label}
                      </span>
                      <span className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{change.text}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
