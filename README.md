# Arke — Kurulum ve Build Rehberi

## 📁 Proje Yapısı

```
arke/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/livekit-token/  # Sesli arama token API
│   │   ├── layout.tsx
│   │   └── page.tsx            # Ana sayfa (auth gate)
│   ├── components/
│   │   ├── auth/AuthPage.tsx   # Giriş/Kayıt ekranı
│   │   ├── layout/             # AppShell + Sidebar
│   │   ├── chat/               # ChatArea + Emoji + VoiceCall
│   │   ├── friends/            # FriendsPanel + FriendRequests
│   │   └── profile/            # ProfilePanel
│   ├── hooks/                  # useMessages, useConversations, useFriends, useVoiceCall
│   ├── store/                  # Zustand: auth + chat
│   ├── lib/supabase.ts         # Supabase client
│   └── types/database.ts       # TypeScript tipleri
├── src-tauri/                  # Tauri desktop wrapper
├── supabase_migration.sql      # Veritabanı şeması
└── .github/workflows/build.yml # Otomatik build
```

---

İleri'de buraları güncelleyeceğim.

Emirhan Yıldırım
Berat Bıçak
