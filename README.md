# ⚔ Lorewarden

Live on [this site](https://decent-caterpillar-sknkwrxs-70e76f15.koyeb.app/)

by:
- Andhika Fadhlan Wijanarko - 2306267164
- Ganendra Garda Pratama - 2306250642
- Jonathan Matius Weni Gerimu - 2306161896
- Mirza Adi Raffiansyah - 2306210323

PPT: https://docs.google.com/presentation/d/1L0tj1WZFk1MWPd0HHHCQ8sepiT7YZfCBDV-bGimfWc4/edit?usp=sharing



> Platform manajemen digital untuk karakter Tabletop Role-Playing Game (TRPG)

Lorewarden memfasilitasi pemain dan Game Master dalam mengelola karakter TRPG. Platform ini menyediakan manajemen karakter dengan atribut statistik, pelacakan status real-time (HP, Spell Slots, Conditions), music room untuk mendengarkan musik bersama, serta battle map kolaboratif untuk sesi bermain.

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Tech Stack](#-tech-stack)
- [Arsitektur](#-arsitektur)
- [Database Schema (ERD)](#-database-schema-erd)
- [Instalasi & Setup](#-instalasi--setup)
- [Deployment (Koyeb)](#-deployment-koyeb)
- [API Documentation](#-api-documentation)
- [WebSocket Events](#-websocket-events)
- [Struktur Folder](#-struktur-folder)
- [Caching Strategy](#-caching-strategy)

---

## ✨ Fitur

### Manajemen Pemain
- CRUD pemain dengan username dan Discord ID
- Melihat jumlah karakter per pemain

### Manajemen Karakter
- Buat karakter dengan class, race, level, background, alignment
- Upload foto karakter (max 5MB)
- 6 ability scores (STR, DEX, CON, INT, WIS, CHA) dengan modifier otomatis
- Filter karakter berdasarkan pemain

### Sesi Bermain (Real-Time Tracker)
- **HP Tracker**: Damage, Heal, Temporary HP, Set HP
- **Spell Slots**: D&D 5e spell slot table otomatis per class/level
- **Conditions**: 14 kondisi D&D 5e (Blinded, Charmed, dll)
- **Death Saving Throws**: 3 sukses / 3 gagal
- **Inspiration & Exhaustion**: Toggle dan level tracker
- Data sesi disimpan di Redis dengan TTL 24 jam

### 🎵 Music Room (Socket.IO)
- Buat/gabung room dengan kode unik
- Queue YouTube video dan dengarkan bersama (synced playback)
- Kontrol playback: play, pause, skip, shuffle, repeat
- Volume dan progress bar per user
- Daftar listener dalam room

### 🗺 Battle Map (Socket.IO + Konva.js)
- Buat/gabung map room dengan kode unik
- **Upload Map**: GM upload background image (battle map)
- **Grid Overlay**: Konfigurasi grid square on/off dan ukuran
- **Token System**: Drag-and-drop token dengan snap-to-grid, warna, dan ukuran custom
- **Fog of War**: GM menggambar area gelap, toggle reveal per area
- **Zoom & Pan**: Scroll untuk zoom, drag tool untuk pan
- Real-time sync semua perubahan via Socket.IO

### Performa
- Redis caching pada endpoint GET (pemain & karakter) dengan TTL 5 menit
- Cache invalidation otomatis saat data berubah (POST/PUT/DELETE)

---

## 🛠 Tech Stack

| Layer          | Teknologi                                   |
|----------------|---------------------------------------------|
| **Frontend**   | React 19 (Vite), Tailwind CSS v4            |
| **Backend**    | Node.js, Express.js, Socket.IO              |
| **Canvas**     | Konva.js + react-konva (Battle Map)         |
| **Database**   | PostgreSQL 15                                |
| **Cache**      | Redis 7 (session tracker + caching)         |
| **Container**  | Docker, Docker Compose                       |
| **Deployment** | Koyeb (Docker), Supabase (PG), Upstash (Redis) |
| **Routing**    | React Router DOM v7                          |

---

## 🏗 Arsitektur

```
┌───────────────────────────────────────────────────────────────┐
│                   React Frontend (Vite)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ ┌───────┐ │
│  │Dashboard │ │ Karakter │ │ Session  │ │ Music │ │  Map  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘ └───┬───┘ │
│       └────────────┼────────────┘            │         │     │
│                    │  REST API                │ Socket.IO     │
├────────────────────┼─────────────────────────┼─────────┼─────┤
│                Express.js + Socket.IO Backend                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐ │
│  │/api/pemain │ │/api/karakter│ │/api/session │ │ WS Rooms  │ │
│  │/api/atribut│ │            │ │            │ │music + map│ │
│  └──────┬─────┘ └──────┬─────┘ └─────┬──────┘ └─────┬─────┘ │
│         │              │              │              │       │
│    ┌────▼──────────────▼──┐     ┌─────▼──────────────▼────┐  │
│    │   PostgreSQL          │     │   Redis                  │  │
│    │ (pemain, karakter,    │     │ (sessions, cache,        │  │
│    │  atribut_stat)        │     │  music/map: in-memory)   │  │
│    └───────────────────────┘     └──────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema (ERD)

```
┌─────────────────┐     ┌──────────────────────────┐     ┌──────────────────────┐
│     pemain       │     │        karakter           │     │    atribut_stat       │
├─────────────────┤     ├──────────────────────────┤     ├──────────────────────┤
│ PK id (SERIAL)  │◄────│ FK pemain_id (INTEGER)   │     │ PK id (SERIAL)       │
│    username      │     │ PK id (SERIAL)           │────►│ FK karakter_id (UNQ) │
│    discord_id    │     │    nama_karakter          │     │    strength           │
│    created_at    │     │    race                   │     │    dexterity          │
└─────────────────┘     │    class                  │     │    constitution       │
                         │    level (1-20)           │     │    intelligence       │
                         │    gambar_url             │     │    wisdom             │
                         │    max_hp                 │     │    charisma           │
                         │    background             │     │    (all 1-30)         │
                         │    alignment              │     └──────────────────────┘
                         │    created_at             │
                         │    updated_at             │
                         └──────────────────────────┘
```

### Relasi
- **pemain → karakter**: One-to-Many (CASCADE delete)
- **karakter → atribut_stat**: One-to-One (CASCADE delete, UNIQUE constraint)

### Redis Data Model (Session)
```
Key: lorewarden:session:{karakter_id}  (HASH, TTL 24h)
Fields: nama, class, level, hp, max_hp, temp_hp,
        spell_1..spell_9, max_spell_1..max_spell_9,
        death_successes, death_failures,
        conditions, inspiration, exhaustion, started_at
```

---

## 🚀 Instalasi & Setup

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- [Node.js](https://nodejs.org/) v18+

### 1. Clone Repository
```bash
git clone https://github.com/<username>/Lorewarden.git
cd Lorewarden
```

### 2. Setup Environment
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Jalankan Database (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 5. Jalankan Development Server

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### 6. Buka Aplikasi
```
http://localhost:5173
```

> Backend berjalan di `http://localhost:3000`. Vite dev server akan proxy `/api`, `/uploads`, dan `/socket.io` secara otomatis.

### Production Build
```bash
cd frontend
npm run build      # Output ke frontend/dist/

cd ../backend
npm start          # Serve frontend/dist/ dan API di port 3000
```

### Environment Variables

| Variable              | Default           | Deskripsi                    |
|-----------------------|-------------------|------------------------------|
| `PORT`                | `3000`            | Port server backend          |
| `POSTGRES_HOST`       | `localhost`       | Host PostgreSQL              |
| `POSTGRES_PORT`       | `5432`            | Port PostgreSQL              |
| `POSTGRES_DB`         | `lorewarden`      | Nama database                |
| `POSTGRES_USER`       | `lorewarden_user` | User database                |
| `POSTGRES_PASSWORD`   | `lorewarden_pass` | Password database            |
| `REDIS_HOST`          | `localhost`       | Host Redis                   |
| `REDIS_PORT`          | `6379`            | Port Redis                   |
| `REDIS_PASSWORD`      | *(none)*          | Password Redis (Upstash)     |
| `REDIS_TLS`           | *(none)*          | Set `true` untuk Upstash     |
| `SESSION_TTL`         | `86400`           | TTL sesi (detik, 24h)        |
| `CORS_ORIGIN`         | `*`               | Allowed origins (comma-sep)  |
| `FRONTEND_DIST_PATH`  | `../../frontend/dist` | Path ke frontend build  |
| `VITE_API_URL`        | *(empty)*         | Backend URL untuk frontend   |

---

## � Deployment (Koyeb)

Lorewarden menggunakan multi-stage Dockerfile untuk deployment.

### External Services
| Service     | Provider | Gratis |
|-------------|----------|--------|
| PostgreSQL  | [Supabase](https://supabase.com) atau [Neon](https://neon.tech) | ✅ |
| Redis       | [Upstash](https://upstash.com) | ✅ |
| Hosting     | [Koyeb](https://koyeb.com) | ✅ |

### Deploy ke Koyeb
1. Push repo ke GitHub
2. Buat project di Supabase → jalankan `backend/migrations/init.sql` di SQL Editor
3. Buat Redis database di Upstash
4. Di Koyeb → **Create Service** → GitHub → pilih repo
5. Builder: **Dockerfile**, Port: **8000**
6. Set environment variables dari Supabase + Upstash
7. Deploy 🚀

---

## �📡 API Documentation

### Pemain
| Method   | Endpoint           | Deskripsi                       |
|----------|--------------------|---------------------------------|
| `GET`    | `/api/pemain`      | List semua pemain               |
| `GET`    | `/api/pemain/:id`  | Detail pemain                   |
| `POST`   | `/api/pemain`      | Buat pemain baru                |
| `PUT`    | `/api/pemain/:id`  | Update pemain                   |
| `DELETE` | `/api/pemain/:id`  | Hapus pemain (cascade karakter) |

### Karakter
| Method   | Endpoint               | Deskripsi                     |
|----------|------------------------|-------------------------------|
| `GET`    | `/api/karakter`        | List karakter (?pemain_id=)   |
| `GET`    | `/api/karakter/:id`    | Detail karakter + atribut     |
| `POST`   | `/api/karakter`        | Buat karakter (multipart)     |
| `PUT`    | `/api/karakter/:id`    | Update karakter (multipart)   |
| `DELETE` | `/api/karakter/:id`    | Hapus karakter                |

### Atribut Stat
| Method   | Endpoint                    | Deskripsi                  |
|----------|-----------------------------|----------------------------|
| `GET`    | `/api/atribut/:karakter_id` | Get atribut + modifiers    |
| `POST`   | `/api/atribut`              | Buat atribut               |
| `PUT`    | `/api/atribut/:karakter_id` | Update atribut             |

### Session (Redis)
| Method   | Endpoint                        | Deskripsi                     |
|----------|---------------------------------|-------------------------------|
| `POST`   | `/api/session/:id/start`        | Mulai/resume sesi             |
| `GET`    | `/api/session/:id`              | Get status sesi               |
| `GET`    | `/api/session`                  | List semua sesi aktif         |
| `PATCH`  | `/api/session/:id/hp`           | Update HP (damage/heal/temp)  |
| `PATCH`  | `/api/session/:id/spell-slots`  | Update spell slots            |
| `PATCH`  | `/api/session/:id/conditions`   | Toggle conditions             |
| `PATCH`  | `/api/session/:id/death-saves`  | Death saving throws           |
| `PATCH`  | `/api/session/:id/misc`         | Inspiration & Exhaustion      |
| `DELETE` | `/api/session/:id`              | Akhiri sesi                   |

---

## 🔌 WebSocket Events

### Music Room
| Event | Direction | Deskripsi |
|-------|-----------|-----------|
| `room:create` | Client → Server | Buat room baru |
| `room:join` | Client → Server | Gabung room |
| `room:leave` | Client → Server | Keluar room |
| `room:state` | Server → Client | Broadcast state room |
| `queue:add` | Client → Server | Tambah lagu ke queue |
| `queue:remove` | Client → Server | Hapus lagu dari queue |
| `queue:clear` | Client → Server | Kosongkan queue |
| `playback:play/pause` | Client → Server | Toggle playback |
| `playback:skip` | Client → Server | Skip next/prev |
| `playback:seek` | Client → Server | Seek ke waktu tertentu |
| `playback:shuffle` | Client → Server | Toggle shuffle |
| `playback:repeat` | Client → Server | Cycle repeat mode |

### Map Room
| Event | Direction | Deskripsi |
|-------|-----------|-----------|
| `map:create` | Client → Server | Buat map room |
| `map:join` | Client → Server | Gabung map room |
| `map:leave` | Client → Server | Keluar map room |
| `map:state` | Server → Client | Broadcast full state |
| `map:setMap` | Client → Server | Upload background map (GM) |
| `map:gridConfig` | Client → Server | Update grid settings (GM) |
| `map:addToken` | Client → Server | Tambah token |
| `map:moveToken` | Client → Server | Pindahkan token |
| `map:tokenMoved` | Server → Client | Broadcast posisi token |
| `map:removeToken` | Client → Server | Hapus token |
| `map:addFog` | Client → Server | Tambah fog area (GM) |
| `map:toggleFog` | Client → Server | Toggle reveal fog (GM) |
| `map:clearFog` | Client → Server | Hapus semua fog (GM) |

---

## 📁 Struktur Folder

```
Lorewarden/
├── backend/
│   ├── migrations/
│   │   └── init.sql                # Schema + seed data
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # PostgreSQL connection pool
│   │   │   └── redis.js            # Redis connection (+TLS)
│   │   ├── routes/
│   │   │   ├── pemain.js           # CRUD pemain + caching
│   │   │   ├── karakter.js         # CRUD karakter + caching
│   │   │   ├── atribut.js          # CRUD atribut stat
│   │   │   ├── session.js          # Session tracker (Redis)
│   │   │   ├── musicRoom.js        # Music room (Socket.IO)
│   │   │   └── mapRoom.js          # Map room (Socket.IO)
│   │   └── index.js                # Express + Socket.IO entry
│   ├── uploads/                    # Character images
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigation bar
│   │   │   ├── Toast.jsx           # Toast notification system
│   │   │   ├── Modal.jsx           # Reusable modal
│   │   │   └── map/
│   │   │       ├── MapCanvas.jsx   # Konva canvas (grid/tokens/fog)
│   │   │       └── MapToolbar.jsx  # Map tools sidebar
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Dashboard + player management
│   │   │   ├── Karakter.jsx        # Character CRUD + stats
│   │   │   ├── Session.jsx         # Real-time session tracker
│   │   │   ├── MusicPlayer.jsx     # Synced YouTube music room
│   │   │   └── MapRoom.jsx         # Collaborative battle map
│   │   ├── api.js                  # REST API client
│   │   ├── App.jsx                 # Router setup
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Tailwind + theme
│   ├── .env.example
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── Dockerfile                      # Multi-stage prod build
├── .dockerignore
├── docker-compose.yml              # Local dev (PostgreSQL + Redis)
├── .gitignore
└── README.md
```

---

## 🗄 Caching Strategy

Lorewarden menggunakan Redis sebagai **database pendukung** dengan dua peran:

### 1. Session Tracker (Primary Use)
- Data sesi bermain (HP, spell slots, conditions) disimpan sebagai Redis Hash
- Key pattern: `lorewarden:session:{karakter_id}`
- TTL: 24 jam — sesi otomatis expired setelah tidak aktif
- **Alasan**: Sesi bermain membutuhkan read/write yang sangat cepat dan data bersifat ephemeral

### 2. Query Cache
- Response dari GET endpoints (pemain list, karakter list) di-cache
- Key pattern: `lorewarden:cache:{entity}:*`
- TTL: 5 menit
- Cache invalidation: Otomatis saat ada operasi POST/PUT/DELETE
- Console logging untuk monitoring cache HIT/MISS
- **Alasan**: Mengurangi beban query ke PostgreSQL untuk data yang jarang berubah

### 3. Real-Time Rooms (In-Memory)
- Music Room dan Map Room state disimpan **in-memory** di server (bukan Redis)
- Auto-cleanup saat room kosong
- **Alasan**: Data ephemeral per-session, tidak perlu persistence

---

## Live Demo Information

- Database: Supabase
- Redis: Upstash
- Deployment: Koyeb

## 📝 Lisensi

Proyek ini dibuat sebagai Proyek Akhir mata kuliah Sistem Basis Data (SBD).
