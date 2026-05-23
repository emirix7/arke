import { create } from 'zustand'
import type { Server, Channel, ChannelMessage, ServerMember } from '@/types/server'

interface ServerState {
  servers: Server[]
  activeServer: Server | null
  channels: Channel[]
  activeChannel: Channel | null
  messages: Record<string, ChannelMessage[]>
  members: ServerMember[]
  voiceMembers: Record<string, any[]> // channelId -> userIds
  setServers: (servers: Server[]) => void
  setActiveServer: (server: Server | null) => void
  setChannels: (channels: Channel[]) => void
  setActiveChannel: (channel: Channel | null) => void
  setMessages: (channelId: string, msgs: ChannelMessage[]) => void
  addMessage: (channelId: string, msg: ChannelMessage) => void
  deleteMessage: (channelId: string, msgId: string) => void
  setMembers: (members: ServerMember[]) => void
  setVoiceMembers: (channelId: string, users: any[]) => void
}

export const useServerStore = create<ServerState>((set) => ({
  servers: [],
  activeServer: null,
  channels: [],
  activeChannel: null,
  messages: {},
  members: [],
  voiceMembers: {},

  setServers: (servers) => set({ servers }),
  setActiveServer: (activeServer) => set({ activeServer }),
  setChannels: (channels) => set({ channels }),
  setActiveChannel: (activeChannel) => set({ activeChannel }),
  setMessages: (channelId, msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } })),
  addMessage: (channelId, msg) => set((s) => ({
    messages: { ...s.messages, [channelId]: [...(s.messages[channelId] || []), msg] }
  })),
  deleteMessage: (channelId, msgId) => set((s) => ({
    messages: {
      ...s.messages,
      [channelId]: (s.messages[channelId] || []).map(m =>
        m.id === msgId ? { ...m, deleted_at: new Date().toISOString() } : m
      )
    }
  })),
  setMembers: (members) => set({ members }),
  setVoiceMembers: (channelId, users) => set((s) => ({
    voiceMembers: { ...s.voiceMembers, [channelId]: users }
  })),
}))
