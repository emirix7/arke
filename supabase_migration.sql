-- =============================================
-- ARKE - Supabase Migration
-- Supabase Dashboard > SQL Editor'e yapıştır
-- =============================================

-- Profiles tablosu (auth.users ile bağlantılı)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  bio TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'dnd', 'offline')),
  custom_status TEXT,
  allow_messages_from TEXT DEFAULT 'everyone' CHECK (allow_messages_from IN ('everyone', 'friends')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Username index
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);

-- Friendships tablosu
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

-- Conversations tablosu (1-1 sohbetler)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  UNIQUE(participant_1, participant_2)
);

-- Direct messages tablosu
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Index for fast message fetching
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.direct_messages(conversation_id, created_at);

-- =============================================
-- RLS (Row Level Security) Politikaları
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: herkes okuyabilir, sadece kendi profilini güncelleyebilir
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Friendships: kendi isteklerini görebilir
CREATE POLICY "Users can view own friendships" ON public.friendships FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send friend requests" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update received requests" ON public.friendships FOR UPDATE
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id);
CREATE POLICY "Users can delete own friendships" ON public.friendships FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Conversations: katılımcılar görebilir
CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: konuşmadaki kullanıcılar görebilir
CREATE POLICY "Participants can view messages" ON public.direct_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );
CREATE POLICY "Participants can send messages" ON public.direct_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );
CREATE POLICY "Users can update own messages" ON public.direct_messages FOR UPDATE
  USING (auth.uid() = sender_id);

-- =============================================
-- Realtime aktif et
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- =============================================
-- last_message_at otomatik güncelleme
-- =============================================
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_message_sent
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();
