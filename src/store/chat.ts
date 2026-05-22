import { create } from 'zustand'
import type { ConversationWithProfile, DirectMessage } from '@/types/database'

interface ChatState {
  conversations: ConversationWithProfile[]
  activeConversation: ConversationWithProfile | null
  messages: Record<string, DirectMessage[]>
  setConversations: (convs: ConversationWithProfile[]) => void
  setActiveConversation: (conv: ConversationWithProfile | null) => void
  addMessage: (convId: string, msg: DirectMessage) => void
  setMessages: (convId: string, msgs: DirectMessage[]) => void
  markRead: (convId: string) => void
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversation: null,
  messages: {},

  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (activeConversation) => set({ activeConversation }),

  addMessage: (convId, msg) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [convId]: [...(state.messages[convId] || []), msg],
      },
    })),

  setMessages: (convId, msgs) =>
    set((state) => ({
      messages: { ...state.messages, [convId]: msgs },
    })),

  markRead: (convId) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === convId ? { ...c, unread_count: 0 } : c
      ),
    })),
}))
