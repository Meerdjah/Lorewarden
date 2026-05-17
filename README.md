# ⚔ Lorewarden

> Platform manajemen digital untuk karakter Tabletop Role-Playing Game (TRPG)

Lorewarden memfasilitasi pemain dan Game Master dalam mengelola karakter TRPG. Platform ini memungkinkan pengguna untuk membuat dan memperbarui database karakter berdasarkan class, race, atribut statistik, serta menyediakan sistem pelacakan status (Health Points, Spell Slots, Conditions) secara real-time saat sesi bermain.

---

## 📋 Daftar Isi

- [Fitur](#-fitur)
- [Tech Stack](#-tech-stack)
- [Arsitektur](#-arsitektur)
- [Database Schema (ERD)](#-database-schema-erd)
- [Instalasi & Setup](#-instalasi--setup)
- [API Documentation](#-api-documentation)
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

### Performa
- Redis caching pada endpoint GET (pemain & karakter) dengan TTL 5 menit
- Cache invalidation otomatis saat data berubah (POST/PUT/DELETE)

---

## 🛠 Tech Stack

| Layer        | Teknologi                              |
|--------------|----------------------------------------|
| **Frontend** | React 19 (Vite), Tailwind CSS v4       |
| **Backend**  | Node.js, Express.js                    |
| **Database** | PostgreSQL 15                           |
| **Cache**    | Redis 7 (session tracker + caching)    |
| **Container**| Docker, Docker Compose                 |
| **Routing**  | React Router DOM v7                    |

---

## 🏗 Arsitektur



![UML](https://i.imgur.com/pK06O0o.png)

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
```

### 3. Jalankan Database (PostgreSQL + Redis)
```bash
docker compose up -d
```

### 4. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
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

> Backend berjalan di `http://localhost:3000`, Vite dev server akan proxy request API secara otomatis.

### Production Build
```bash
cd frontend
npm run build      # Output ke frontend/dist/

cd ../backend
npm start          # Serve frontend/dist/ dan API di port 3000
```

### Environment Variables
| Variable         | Default          | Deskripsi              |
|------------------|------------------|------------------------|
| `PORT`           | `3000`           | Port server backend    |
| `POSTGRES_HOST`  | `localhost`      | Host PostgreSQL        |
| `POSTGRES_PORT`  | `5432`           | Port PostgreSQL        |
| `POSTGRES_DB`    | `lorewarden`     | Nama database          |
| `POSTGRES_USER`  | `lorewarden_user`| User database          |
| `POSTGRES_PASSWORD`| `lorewarden_pass`| Password database    |
| `REDIS_HOST`     | `localhost`      | Host Redis             |
| `REDIS_PORT`     | `6379`           | Port Redis             |
| `SESSION_TTL`    | `86400`          | TTL sesi (detik, 24h)  |

---

## 📡 API Documentation

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

## 📁 Struktur Folder

```
Lorewarden/
├── backend/
│   ├── migrations/
│   │   └── init.sql                # Schema + seed data
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js               # PostgreSQL connection pool
│   │   │   └── redis.js            # Redis connection
│   │   ├── routes/
│   │   │   ├── pemain.js           # CRUD pemain + caching
│   │   │   ├── karakter.js         # CRUD karakter + caching
│   │   │   ├── atribut.js          # CRUD atribut stat
│   │   │   └── session.js          # Session tracker (Redis)
│   │   └── index.js                # Express entry point
│   ├── uploads/                    # Character images
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx          # Navigation bar
│   │   │   ├── Toast.jsx           # Toast notification system
│   │   │   └── Modal.jsx           # Reusable modal
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Dashboard + player management
│   │   │   ├── Karakter.jsx        # Character CRUD + stats
│   │   │   └── Session.jsx         # Real-time session tracker
│   │   ├── api.js                  # API client
│   │   ├── App.jsx                 # Router setup
│   │   ├── main.jsx                # Entry point
│   │   └── index.css               # Tailwind + theme
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── docker-compose.yml              # PostgreSQL + Redis
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

---

## 📝 Lisensi

Proyek ini dibuat sebagai Proyek Akhir mata kuliah Sistem Basis Data (SBD).
