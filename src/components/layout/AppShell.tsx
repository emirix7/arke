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
import type { Server } from '@/types/server'
import type { Channel } from '@/types/server'

export type AppView = 'messages' | 'friends' | 'calls' | 'settings' | 'server'

export default function AppShell() {
  const [view, setView] = useState<AppView>('messages')
  const [dnd, setDnd] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const { activeConversation } = useChatStore()
  const { activeServer, setActiveServer, activeChannel, setActiveChannel } = useServerStore()
  const { incomingCall, acceptCall, declineCall } = useGlobalCall()
  useReconnect()

  // Keep voice channel alive when switching to text
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<Channel | null>(null)
  const [activeTextChannel, setActiveTextChannel] = useState<Channel | null>(null)

  const handleChannelSelect = (channel: Channel | null) => {
    setActiveChannel(channel)
    if (!channel) return
    if (channel.type === 'voice') {
      setActiveVoiceChannel(channel)
    } else {
      setActiveTextChannel(channel)
    }
  }

  const handleServerSelect = (server: Server) => {
    setActiveServer(server)
    setActiveChannel(null)
    setActiveVoiceChannel(null)
    setActiveTextChannel(null)
    setView('server')
  }

  const handleLeaveVoice = () => {
    setActiveVoiceChannel(null)
    setActiveChannel(activeTextChannel)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: '#0d0d14' }}>
      <div className="titlebar absolute top-0 left-0 right-0 z-50" />

      <ServerSidebar onSelect={handleServerSelect} activeServerId={view === 'server' ? activeServer?.id : undefined} />

      <Sidebar
        activeView={view}
        onViewChange={(v) => { setView(v); if (v !== 'server') { setActiveServer(null); setActiveVoiceChannel(null) } }}
        dnd={dnd} micMuted={micMuted}
        onToggleDnd={() => setDnd(p => !p)}
        onToggleMic={() => setMicMuted(p => !p)}
      />

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
            {/* Voice channel - stays mounted when switching to text */}
            {activeVoiceChannel && (
              <div style={{ display: activeChannel?.type === 'voice' ? 'flex' : 'none', flex: activeChannel?.type === 'voice' ? 1 : 'none', flexDirection: 'column' }}>
                <VoiceChannel channel={activeVoiceChannel} onLeave={handleLeaveVoice} />
              </div>
            )}
            {/* Text channel */}
            {activeChannel?.type === 'text' && (
              <>
                {/* Mini voice indicator when in voice + text */}
                {activeVoiceChannel && (
                  <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                    style={{ background: 'rgba(61,255,154,0.06)', borderBottom: '1px solid rgba(61,255,154,0.15)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: '#3dff9a', animation: 'pulse-dot 2s infinite' }} />
                    <span className="text-xs" style={{ color: '#3dff9a' }}>Sesli kanaladasın: #{activeVoiceChannel.name}</span>
                    <button onClick={handleLeaveVoice} className="ml-auto text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(255,107,157,0.15)', color: '#ff6b9d', border: '1px solid rgba(255,107,157,0.2)' }}>
                      Ayrıl
                    </button>
                  </div>
                )}
                <ChannelChat />
              </>
            )}
            {!activeChannel && <EmptyState text="Bir kanal seç" />}
          </div>
        </>
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
