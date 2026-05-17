-- ============================================================
-- Lorewarden — Database Dump
-- Kelompok:
--   Andhika Fadhlan Wijanarko  - 2306267164
--   Ganendra Garda Pratama     - 2306250642
--   Jonathan Matius Weni Gerimu - 2306161896
--   Mirza Adi Raffiansyah      - 2306210323
-- ============================================================

-- Pengaturan koneksi
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- ============================================================
-- FUNCTIONS
-- ============================================================

--
-- Name: update_updated_at(); Type: FUNCTION
-- Deskripsi: Trigger function untuk auto-update kolom updated_at
--            pada tabel karakter setiap kali ada operasi UPDATE.
--

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ============================================================
-- TABLES
-- ============================================================

--
-- Name: pemain; Type: TABLE
-- Deskripsi: Menyimpan data identitas pemain TRPG.
--            discord_id bersifat opsional namun unik jika diisi.
--

CREATE TABLE IF NOT EXISTS public.pemain (
    id         SERIAL       PRIMARY KEY,
    username   VARCHAR(100) NOT NULL UNIQUE,
    discord_id VARCHAR(50)  UNIQUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

--
-- Name: karakter; Type: TABLE
-- Deskripsi: Menyimpan data karakter TRPG per pemain.
--            Mendukung sistem D&D 5e: class, race, level (1-20),
--            alignment, background, dan upload foto karakter.
--

CREATE TABLE IF NOT EXISTS public.karakter (
    id            SERIAL       PRIMARY KEY,
    pemain_id     INTEGER      NOT NULL
                               REFERENCES public.pemain(id)
                               ON DELETE CASCADE,
    nama_karakter VARCHAR(100) NOT NULL,
    race          VARCHAR(50)  NOT NULL,
    class         VARCHAR(50)  NOT NULL,
    level         INTEGER      NOT NULL DEFAULT 1,
    gambar_url    TEXT,
    max_hp        INTEGER      NOT NULL DEFAULT 10,
    background    VARCHAR(100),
    alignment     VARCHAR(50),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT level_check  CHECK (level BETWEEN 1 AND 20),
    CONSTRAINT max_hp_check CHECK (max_hp > 0)
);

--
-- Name: atribut_stat; Type: TABLE
-- Deskripsi: Menyimpan enam ability score D&D 5e untuk setiap karakter.
--            Relasi One-to-One dengan karakter (UNIQUE pada karakter_id).
--            Nilai valid: 1-30 (termasuk bonus magis/racial).
--

CREATE TABLE IF NOT EXISTS public.atribut_stat (
    id           SERIAL  PRIMARY KEY,
    karakter_id  INTEGER NOT NULL UNIQUE
                         REFERENCES public.karakter(id)
                         ON DELETE CASCADE,
    strength     INTEGER NOT NULL DEFAULT 10,
    dexterity    INTEGER NOT NULL DEFAULT 10,
    constitution INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom       INTEGER NOT NULL DEFAULT 10,
    charisma     INTEGER NOT NULL DEFAULT 10,
    CONSTRAINT str_check CHECK (strength     BETWEEN 1 AND 30),
    CONSTRAINT dex_check CHECK (dexterity    BETWEEN 1 AND 30),
    CONSTRAINT con_check CHECK (constitution BETWEEN 1 AND 30),
    CONSTRAINT int_check CHECK (intelligence BETWEEN 1 AND 30),
    CONSTRAINT wis_check CHECK (wisdom       BETWEEN 1 AND 30),
    CONSTRAINT cha_check CHECK (charisma     BETWEEN 1 AND 30)
);

-- ============================================================
-- TRIGGERS
-- ============================================================

--
-- Name: karakter_updated_at; Type: TRIGGER
-- Deskripsi: Otomatis memperbarui kolom updated_at setiap kali
--            ada operasi UPDATE pada baris di tabel karakter.
--

DROP TRIGGER IF EXISTS karakter_updated_at ON public.karakter;

CREATE TRIGGER karakter_updated_at
    BEFORE UPDATE ON public.karakter
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- SEQUENCES (reset untuk fresh import)
-- ============================================================

SELECT setval('public.pemain_id_seq',    1, false);
SELECT setval('public.karakter_id_seq',  1, false);
SELECT setval('public.atribut_stat_id_seq', 1, false);

-- ============================================================
-- DATA — SEED / CONTOH
-- ============================================================

--
-- Data: pemain
--

INSERT INTO public.pemain (username, discord_id) VALUES
    ('Gandalf_the_Grey',  'gandalf#1234'),
    ('Aragorn_II',        'aragorn#5678'),
    ('Legolas_Greenleaf', 'legolas#9012')
ON CONFLICT DO NOTHING;

--
-- Data: karakter
--

INSERT INTO public.karakter
    (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Mithrandir', 'Human', 'Wizard', 12, 72, 'Sage', 'Neutral Good'
FROM public.pemain p
WHERE p.username = 'Gandalf_the_Grey'
ON CONFLICT DO NOTHING;

INSERT INTO public.karakter
    (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Strider', 'Human', 'Ranger', 10, 88, 'Outlander', 'Lawful Good'
FROM public.pemain p
WHERE p.username = 'Aragorn_II'
ON CONFLICT DO NOTHING;

INSERT INTO public.karakter
    (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Greenleaf', 'Elf', 'Fighter', 8, 64, 'Noble', 'Chaotic Good'
FROM public.pemain p
WHERE p.username = 'Legolas_Greenleaf'
ON CONFLICT DO NOTHING;

--
-- Data: atribut_stat
-- Format: (STR, DEX, CON, INT, WIS, CHA)
--

INSERT INTO public.atribut_stat
    (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 10, 16, 14, 20, 18, 14
FROM public.karakter k
WHERE k.nama_karakter = 'Mithrandir'
ON CONFLICT DO NOTHING;

INSERT INTO public.atribut_stat
    (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 18, 16, 16, 14, 14, 16
FROM public.karakter k
WHERE k.nama_karakter = 'Strider'
ON CONFLICT DO NOTHING;

INSERT INTO public.atribut_stat
    (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 14, 20, 14, 12, 14, 12
FROM public.karakter k
WHERE k.nama_karakter = 'Greenleaf'
ON CONFLICT DO NOTHING;
