'use client'

const BADGES: Record<string, { icon: string; label: string; color: string; desc: string }> = {
  first_message: { icon: '💬', label: 'İlk Adım', color: '#c044ff', desc: 'İlk mesajını attın!' },
  century: { icon: '💯', label: 'Yüzlük', color: '#00d4ff', desc: '100 mesaj attın' },
  chatterbox: { icon: '🗣️', label: 'Konuşkan', color: '#ff6b9d', desc: '1000 mesaj attın' },
  social: { icon: '🤝', label: 'Sosyal', color: '#3dff9a', desc: 'İlk arkadaşını ekledin' },
  popular: { icon: '⭐', label: 'Popüler', color: '#ffb347', desc: '10 arkadaşın var' },
  early_adopter: { icon: '🚀', label: 'Erken Kullanıcı', color: '#c044ff', desc: 'İlk kullanıcılardan birisin' },
}

interface BadgeDisplayProps {
  badges: string[]
  size?: 'sm' | 'md'
}

export default function BadgeDisplay({ badges, size = 'md' }: BadgeDisplayProps) {
  if (!badges || badges.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map(badge => {
        const b = BADGES[badge]
        if (!b) return null
        return (
          <div key={badge} title={`${b.label}: ${b.desc}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold cursor-default"
            style={{ background: `${b.color}15`, border: `1px solid ${b.color}35`, color: b.color }}>
            <span style={{ fontSize: size === 'sm' ? 11 : 13 }}>{b.icon}</span>
            {size === 'md' && <span>{b.label}</span>}
          </div>
        )
      })}
    </div>
  )
}

export { BADGES }
