'use client'
import { useState, useRef } from 'react'
import Sidebar from './Sidebar'
import ServerSidebar from '@/components/servers/ServerSidebar'
import ChannelSidebar from '@/components/servers/ChannelSidebar'
import ChannelChat from '@/components/servers/ChannelChat'
import VoiceChannel from '@/components/servers/VoiceChannel'
import FriendsPanel from '@/components/friends/FriendsPanel'
import ChatArea from '@/components/chat/ChatArea'
import ProfilePanel from '@/components/profile/ProfilePanel'
import FriendRequests from '@/components/friends/FriendRequests'
import SettingsPage from '@/components/profile/SettingsPage'
import IncomingCallBanner from '@/components/chat/IncomingCallBanner'
import { useChatStore } from '@/store/chat'
import { useServerStore } from '@/store/server'
import { useGlobalCall } from '@/hooks/useGlobalCall'
import { useReconnect } from '@/hooks/useReconnect'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { Volume2, PhoneOff } from 'lucide-react'
import type { Server, Channel } from '@/types/server'

export type AppView = 'messages' | 'friends' | 'settings' | 'server'

export default function AppShell() {
  const [view, setView] = useState<AppView>('messages')
  const [dnd, setDnd] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const { activeConversation } = useChatStore()
  const { activeServer, setActiveServer, activeChannel, setActiveChannel } = useServerStore()
  const { incomingCall, acceptCall, declineCall } = useGlobalCall()
  useReconnect()
  useRealtimeUpdates()

  // Persistent voice channel - survives navigation
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null)
  const [activeVoiceServer, setActiveVoiceServer] = useState<Server | null>(null)
  const [activeTextChannel, setActiveTextChannel] = useState<Channel | null>(null)
  const [showVoiceFullscreen, setShowVoiceFullscreen] = useState(false)

  const handleChannelSelect = async (channel: Channel | null) => {
    setActiveChannel(channel)
    if (!channel) return
    if (channel.type === 'voice') {
      // If already in a different voice channel, clean up first
      if (activeVoiceChannel && activeVoiceChannel.id !== channel.id) {
        // Delete ALL voice sessions for this user before joining new channel
        const { supabase: sb } = await import('@/lib/supabase')
        await sb.from('voice_sessions').delete().eq('user_id', (await sb.auth.getUser()).data.user?.id ?? '')
      }
      setActiveVoiceChannel(channel)
      setActiveVoiceServer(activeServer)
      setShowVoiceFullscreen(true)
    } else {
      setActiveTextChannel(channel)
      setShowVoiceFullscreen(false)
    }
  }

  const handleServerSelect = (server: Server) => {
    setActiveServer(server)
    setActiveChannel(null)
    setActiveTextChannel(null)
    setShowVoiceFullscreen(false)
    setView('server')
  }

  const handleLeaveVoice = () => {
    setActiveVoiceChannel(null)
    setActiveVoiceServer(null)
    setShowVoiceFullscreen(false)
    if (activeTextChannel) setActiveChannel(activeTextChannel)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0d0d14' }}>
      <div className="titlebar absolute top-0 left-0 right-0 z-50" />

      <ServerSidebar onSelect={handleServerSelect} activeServerId={view === 'server' ? activeServer?.id : undefined} />

      <Sidebar
        activeView={view}
        onViewChange={(v) => { setView(v as AppView); if (v !== 'server') setActiveServer(null) }}
        dnd={dnd} micMuted={micMuted}
        onToggleDnd={() => setDnd(p => !p)}
        onToggleMic={() => setMicMuted(p => !p)}
      />

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {view === 'messages' && (
          <>
            <FriendsPanel />
            {activeConversation ? (
              <>
                <ChatArea globalMicMuted={micMuted} />
                <ProfilePanel />
              </>
            ) : <EmptyState />}
          </>
        )}

        {view === 'friends' && <div className="flex-1 overflow-hidden"><FriendRequests /></div>}
        {view === 'settings' && <div className="flex-1 overflow-hidden"><SettingsPage /></div>}

        {view === 'server' && activeServer && (
          <>
            <ChannelSidebar onChannelSelect={handleChannelSelect} />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Voice shown fullscreen when active voice channel selected */}
              {activeVoiceChannel && showVoiceFullscreen && (
                <VoiceChannel key={activeVoiceChannel.id} channel={activeVoiceChannel} onLeave={handleLeaveVoice} globalMicMuted={micMuted} />
              )}
              {/* Text channel */}
              {activeChannel?.type === 'text' && !showVoiceFullscreen && (
                <ChannelChat />
              )}
              {!activeChannel && !showVoiceFullscreen && <EmptyState text="Bir kanal seç" />}
            </div>
          </>
        )}
      </div>

      {/* Persistent voice bar - visible everywhere when in voice */}
      {activeVoiceChannel && !showVoiceFullscreen && (
        <div className="fixed bottom-4 left-20 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
          style={{ background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(61,255,154,0.25)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3dff9a', animation: 'pulse-dot 2s infinite' }} />
          <Volume2 size={14} strokeWidth={2} style={{ color: '#3dff9a', flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: '#3dff9a' }}>
            {activeVoiceServer?.name} — #{activeVoiceChannel.name}
          </span>
          <button
            onClick={() => { setView('server'); setActiveServer(activeVoiceServer!); setShowVoiceFullscreen(true); setActiveChannel(activeVoiceChannel) }}
            className="text-xs px-2 py-1 rounded-lg ml-1 transition-all"
            style={{ background: 'rgba(61,255,154,0.1)', color: '#3dff9a', border: '1px solid rgba(61,255,154,0.2)' }}>
            Geri Dön
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setMicMuted(p => !p)}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{ background: micMuted ? 'rgba(255,107,157,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${micMuted ? 'rgba(255,107,157,0.4)' : 'rgba(255,255,255,0.1)'}`, color: micMuted ? '#ff6b9d' : 'rgba(255,255,255,0.6)' }}>
              {micMuted ? '🔇' : '🎤'}
            </button>
            <button onClick={handleLeaveVoice}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
              style={{ background: 'rgba(255,107,157,0.2)', border: '1px solid rgba(255,107,157,0.4)', color: '#ff6b9d' }}>
              <PhoneOff size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {incomingCall && !dnd && (
        <IncomingCallBanner
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          onAccept={() => { acceptCall(); setView('messages') }}
          onDecline={declineCall}
        />
      )}
    </div>
  )
}

function EmptyState({ text = 'Bir sohbet seç' }: { text?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4" style={{ background: '#0d0d14' }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.15)' }}>
        <span className="text-3xl">💬</span>
      </div>
      <p className="font-syne font-semibold text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</p>
    </div>
  )
}
