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

## 🚀 ADIM 1 — Gerekli araçları kur

### macOS için:
```bash
# Node.js (zaten yoksa)
brew install node

# Rust (Tauri için şart)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Tauri CLI
cargo install tauri-cli
```

### Windows için:
1. https://nodejs.org → Node.js indir (LTS)
2. https://rustup.rs → rustup-init.exe indir, çalıştır
3. PowerShell'de: `cargo install tauri-cli`
4. https://aka.ms/vs/17/release/vs_BuildTools.exe → Visual Studio Build Tools indir (C++ seç)

---

## 🗄️ ADIM 2 — Supabase kurulum (ücretsiz)

1. https://supabase.com → "New Project" oluştur
2. Dashboard > **SQL Editor** aç
3. `supabase_migration.sql` dosyasının içeriğini kopyala, yapıştır, **Run** bas
4. Dashboard > **Settings > API** sekmesinden al:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## 🔊 ADIM 3 — LiveKit kurulum (sesli arama)

1. https://cloud.livekit.io → ücretsiz hesap aç
2. Yeni proje oluştur
3. **Settings** sekmesinden al:
   - `WSS URL` → `NEXT_PUBLIC_LIVEKIT_URL`
   - `API Key` → `LIVEKIT_API_KEY`
   - `API Secret` → `LIVEKIT_API_SECRET`

---

## ⚙️ ADIM 4 — .env.local oluştur

Proje klasöründe `.env.local` dosyası oluştur (`.env.local.example`'a bak):

```env
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...

NEXT_PUBLIC_LIVEKIT_URL=wss://XXXX.livekit.cloud
LIVEKIT_API_KEY=APIxxx
LIVEKIT_API_SECRET=secretxxx
```

---

## 📦 ADIM 5 — Bağımlılıkları kur

```bash
cd arke
npm install
```

---

## 🧪 ADIM 6 — Geliştirme modunda çalıştır

### Sadece web (tarayıcıda test):
```bash
npm run dev
# http://localhost:3000 aç
```

### Desktop app olarak (Tauri):
```bash
npm run tauri:dev
# Uygulama penceresi açılır
```

---

## 📦 ADIM 7 — .exe / .dmg Build almak

### macOS için .dmg:
```bash
npm run tauri:build
# Çıktı: src-tauri/target/release/bundle/dmg/Arke_0.1.0_x64.dmg
```

### Windows için .exe:
Windows bilgisayarda aynı komutu çalıştır:
```bash
npm run tauri:build
# Çıktı: src-tauri/target/release/bundle/msi/Arke_0.1.0_x64_en-US.msi
#         src-tauri/target/release/bundle/nsis/Arke_0.1.0_x64-setup.exe
```

### macOS'tan Windows .exe otomatik build (GitHub Actions):
1. Kodu GitHub'a push et
2. `.github/workflows/build.yml` otomatik çalışır
3. `v0.1.0` şeklinde bir tag oluştur:
   ```bash
   git tag v0.1.0
   git push origin v0.1.0
   ```
4. GitHub > Actions sekmesinde build izle
5. Tamamlandığında Releases sayfasında .exe, .dmg, .AppImage hazır

---

## 🎨 Özellikler

| Özellik | Durum |
|---|---|
| Kullanıcı adı + şifre ile kayıt/giriş | ✅ |
| Benzersiz kullanıcı adları | ✅ |
| Arkadaş ekleme (istek gönder/kabul et) | ✅ |
| 1-1 gerçek zamanlı mesajlaşma | ✅ |
| Emoji picker | ✅ |
| Görüldü sistemi (✓✓) | ✅ |
| Mesaj saati | ✅ |
| Çevrimiçi durumu | ✅ |
| Sesli arama (LiveKit) | ✅ |
| Mikrofon açma/kapama | ✅ |
| Ses kapatma (deafen) | ✅ |
| Profil kartı | ✅ |
| Banner (gif/resim) alanı | ✅ (upload yakında) |
| Biyografi | ✅ |
| Desktop app (Tauri) | ✅ |
| Cross-platform build | ✅ |

---

## 🔒 Güvenlik Notları

- Tüm tablolarda **Row Level Security (RLS)** aktif — kullanıcılar sadece kendi verilerini görebilir
- IP adresleri hiçbir zaman paylaşılmaz — LiveKit relay üzerinden ses gider
- Şifreler Supabase tarafından bcrypt ile hashlenir
- DDoS koruması için Cloudflare önüne alabilirsin (ücretsiz plan yeter)

---

## 📈 İlerleyen Aşama (Faz 2)

Kullanıcı sayısı artınca:
- LiveKit Cloud → self-hosted LiveKit (VPS'e kur)
- Supabase Free → Pro plan
- Cloudflare CDN ekle
- Profil fotoğrafı/banner upload (Supabase Storage)
- Grup sesli odalar
- Mobil uygulama (React Native + Tauri Mobile)
