'use client'
import { useState, useEffect } from 'react'
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
import VoiceRoom from '@/components/chat/VoiceRoom'
import IncomingCallBanner from '@/components/chat/IncomingCallBanner'
import ToastNotification from '@/components/ui/ToastNotification'
import { useChatStore } from '@/store/chat'
import { useServerStore } from '@/store/server'
import { useGlobalCall } from '@/hooks/useGlobalCall'
import { useReconnect } from '@/hooks/useReconnect'
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates'
import { Volume2, PhoneOff, Mic, MicOff } from 'lucide-react'
import { useGlobalVoiceCall } from '@/hooks/useVoiceCall'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import type { Server, Channel } from '@/types/server'

export type AppView = 'messages' | 'friends' | 'settings' | 'server'

export default function AppShell() {
  const [view, setView] = useState<AppView>('messages')
  const [dnd, setDnd] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const { activeConversation, conversations } = useChatStore()
  const { activeServer, setActiveServer, activeChannel, setActiveChannel } = useServerStore()
  const { profile } = useAuthStore()
  const { incomingCall, acceptCall, declineCall } = useGlobalCall()
  useReconnect()
  useRealtimeUpdates()

  // Global 1:1 call state - use dedicated hook
  const { callState, acceptCall: acceptVoiceCall, declineCall: declineVoiceCall, leaveCall, endCall, rejoinCall } = useGlobalVoiceCall()

  // Persistent voice channel state
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null)
  const [activeVoiceServer, setActiveVoiceServer] = useState<Server | null>(null)
  const [activeTextChannel, setActiveTextChannel] = useState<Channel | null>(null)
  const [showVoiceFullscreen, setShowVoiceFullscreen] = useState(false)
  const [channelMuted, setChannelMuted] = useState(false)

  const handleChannelSelect = async (channel: Channel | null) => {
    setActiveChannel(channel)
    if (!channel) return

    if (channel.type === 'voice') {
      // Leave current voice channel session before joining new one
      if (profile) {
        await supabase.from('voice_sessions').delete().eq('user_id', profile.id)
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

  const handleLeaveVoice = async () => {
    if (profile) {
      await supabase.from('voice_sessions').delete().eq('user_id', profile.id)
    }
    setActiveVoiceChannel(null)
    setActiveVoiceServer(null)
    setShowVoiceFullscreen(false)
    if (activeTextChannel) setActiveChannel(activeTextChannel)
  }

  const handleNavChange = (v: string) => {
    // Don't destroy voice when navigating - just hide fullscreen
    setView(v as AppView)
    setShowVoiceFullscreen(false)
    if (v !== 'server') setActiveServer(null)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0d0d14' }}>
      <div className="titlebar absolute top-0 left-0 right-0 z-50" />

      <ServerSidebar onSelect={handleServerSelect} activeServerId={view === 'server' ? activeServer?.id : undefined} />

      <Sidebar
        activeView={view}
        onViewChange={handleNavChange}
        dnd={dnd} micMuted={micMuted}
        onToggleDnd={() => setDnd(p => !p)}
        onToggleMic={() => setMicMuted(p => !p)}
      />

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
              {activeVoiceChannel && showVoiceFullscreen && (
                <VoiceChannel
                  key={activeVoiceChannel.id}
                  channel={activeVoiceChannel}
                  onLeave={handleLeaveVoice}
                  globalMicMuted={micMuted}
                />
              )}
              {activeChannel?.type === 'text' && !showVoiceFullscreen && (
                <ChannelChat />
              )}
              {!activeChannel && !showVoiceFullscreen && <EmptyState text="Bir kanal seç" />}
            </div>
          </>
        )}
      </div>

      {/* Persistent voice bar — shows when in voice channel but not viewing it */}
      {activeVoiceChannel && !showVoiceFullscreen && (
        <div className="fixed bottom-4 left-20 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl"
          style={{ background: 'rgba(10,10,20,0.97)', border: '1px solid rgba(61,255,154,0.25)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#3dff9a', animation: 'pulse-dot 2s infinite' }} />
          <Volume2 size={13} strokeWidth={2} style={{ color: '#3dff9a', flexShrink: 0 }} />
          <span className="text-xs font-medium" style={{ color: '#3dff9a' }}>
            {activeVoiceServer?.name} — #{activeVoiceChannel.name}
          </span>
          <button
            onClick={() => {
              if (activeVoiceServer) {
                setActiveServer(activeVoiceServer)
                setView('server')
                setShowVoiceFullscreen(true)
                setActiveChannel(activeVoiceChannel)
              }
            }}
            className="text-xs px-2 py-1 rounded-lg ml-1 transition-all"
            style={{ background: 'rgba(61,255,154,0.1)', color: '#3dff9a', border: '1px solid rgba(61,255,154,0.2)' }}>
            Geri Dön
          </button>
          <button onClick={() => setChannelMuted(p => !p)}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ background: channelMuted ? 'rgba(255,107,157,0.2)' : 'rgba(255,255,255,0.06)', border: `1px solid ${channelMuted ? 'rgba(255,107,157,0.4)' : 'rgba(255,255,255,0.1)'}`, color: channelMuted ? '#ff6b9d' : 'rgba(255,255,255,0.5)' }}>
            {channelMuted ? <MicOff size={11} strokeWidth={2} /> : <Mic size={11} strokeWidth={2} />}
          </button>
          <button onClick={handleLeaveVoice}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all"
            style={{ background: 'rgba(255,107,157,0.2)', border: '1px solid rgba(255,107,157,0.4)', color: '#ff6b9d' }}>
            <PhoneOff size={11} strokeWidth={2} />
          </button>
        </div>
      )}

      {/* Call overlay moved to ChatArea */}

      <ToastNotification />

      {/* VoiceRoom keeps LiveKit connection alive globally - no UI */}
      {callState.active && callState.token && callState.status === 'connected' && (
        <VoiceRoom token={callState.token} roomName={callState.roomName} globalMicMuted={micMuted} />
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
  const isDefault = text === 'Bir sohbet seç'
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5" style={{ background: '#0d0d14' }}>
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{ background: 'rgba(192,68,255,0.1)', border: '1px solid rgba(192,68,255,0.15)' }}>
        <span className="text-3xl">💬</span>
      </div>
      <div className="text-center flex flex-col gap-2">
        <p className="font-syne font-semibold text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>{text}</p>
        {isDefault && (
          <p className="text-sm max-w-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Arkadaş eklemek için sol menüdeki <span style={{ color: '#c044ff' }}>👥 Arkadaşlar</span> sekmesine git
          </p>
        )}
      </div>
      {isDefault && (
        <div className="flex flex-col gap-2 items-center text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          <p>veya sol üstteki <span style={{ color: 'rgba(255,255,255,0.4)' }}>+</span> ile yeni sunucu oluştur</p>
          <p><span style={{ color: 'rgba(255,255,255,0.4)' }}>🔗</span> ile davet koduyla sunucuya katıl</p>
        </div>
      )}
    </div>
  )
}
