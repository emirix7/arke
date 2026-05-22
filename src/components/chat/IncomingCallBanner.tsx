'use client'
import { useEffect, useState } from 'react'

interface IncomingCallBannerProps {
  callerName: string
  callerAvatar?: string
  onAccept: () => void
  onDecline: () => void
}

export default function IncomingCallBanner({ callerName, callerAvatar, onAccept, onDecline }: IncomingCallBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setTimeout(() => setVisible(true), 50)
  }, [])

  const initials = callerName.slice(0, 2).toUpperCase()

  return (
    <div
      className="fixed top-6 right-6 z-[100] transition-all duration-300"
      style={{
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
        opacity: visible ? 1 : 0,
      }}
    >
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-2xl"
        style={{
          background: 'rgba(16,16,28,0.97)',
          border: '1px solid rgba(61,255,154,0.25)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(61,255,154,0.1)',
          backdropFilter: 'blur(20px)',
          minWidth: 280,
        }}
      >
        {/* Pulse ring */}
        <div className="relative flex-shrink-0">
          <div className="absolute -inset-1.5 rounded-full animate-ping"
            style={{ background: 'rgba(61,255,154,0.2)' }} />
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #ff6b9d, #c044ff)', position: 'relative' }}
          >
            {callerAvatar
              ? <img src={callerAvatar} alt="" className="w-full h-full object-cover" />
              : initials}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold tracking-widest uppercase mb-0.5"
            style={{ color: '#3dff9a' }}>Gelen Sesli Arama</p>
          <p className="font-syne font-bold text-sm truncate" style={{ color: '#f0eeff' }}>
            {callerName}
          </p>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onDecline}
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-150"
            style={{ background: 'rgba(255,107,157,0.15)', border: '1px solid rgba(255,107,157,0.35)' }}
            title="Reddet"
          >
            📵
          </button>
          <button
            onClick={onAccept}
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all duration-150"
            style={{ background: 'rgba(61,255,154,0.15)', border: '1px solid rgba(61,255,154,0.35)' }}
            title="Kabul Et"
          >
            📞
          </button>
        </div>
      </div>
    </div>
  )
}
