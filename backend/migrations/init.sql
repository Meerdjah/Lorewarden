-- ============================================
-- Lorewarden Database Schema
-- ============================================

CREATE TABLE IF NOT EXISTS pemain (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(100) NOT NULL UNIQUE,
    discord_id VARCHAR(50) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS karakter (
    id            SERIAL PRIMARY KEY,
    pemain_id     INTEGER NOT NULL REFERENCES pemain(id) ON DELETE CASCADE,
    nama_karakter VARCHAR(100) NOT NULL,
    race          VARCHAR(50) NOT NULL,
    class         VARCHAR(50) NOT NULL,
    level         INTEGER DEFAULT 1,
    gambar_url    TEXT,
    max_hp        INTEGER DEFAULT 10,
    background    VARCHAR(100),
    alignment     VARCHAR(50),
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW(),
    CONSTRAINT level_check  CHECK (level BETWEEN 1 AND 20),
    CONSTRAINT max_hp_check CHECK (max_hp > 0)
);

CREATE TABLE IF NOT EXISTS atribut_stat (
    id          SERIAL PRIMARY KEY,
    karakter_id INTEGER NOT NULL UNIQUE REFERENCES karakter(id) ON DELETE CASCADE,
    strength    INTEGER DEFAULT 10,
    dexterity   INTEGER DEFAULT 10,
    constitution INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    wisdom      INTEGER DEFAULT 10,
    charisma    INTEGER DEFAULT 10,
    CONSTRAINT str_check CHECK (strength    BETWEEN 1 AND 30),
    CONSTRAINT dex_check CHECK (dexterity   BETWEEN 1 AND 30),
    CONSTRAINT con_check CHECK (constitution BETWEEN 1 AND 30),
    CONSTRAINT int_check CHECK (intelligence BETWEEN 1 AND 30),
    CONSTRAINT wis_check CHECK (wisdom      BETWEEN 1 AND 30),
    CONSTRAINT cha_check CHECK (charisma    BETWEEN 1 AND 30)
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER karakter_updated_at
BEFORE UPDATE ON karakter
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Seed Data
-- ============================================

INSERT INTO pemain (username, discord_id) VALUES
    ('Gandalf_the_Grey', 'gandalf#1234'),
    ('Aragorn_II',       'aragorn#5678'),
    ('Legolas_Greenleaf','legolas#9012')
ON CONFLICT DO NOTHING;

INSERT INTO karakter (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Mithrandir', 'Human', 'Wizard', 12, 72, 'Sage', 'Neutral Good'
FROM pemain p WHERE p.username = 'Gandalf_the_Grey'
ON CONFLICT DO NOTHING;

INSERT INTO karakter (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Strider', 'Human', 'Ranger', 10, 88, 'Outlander', 'Lawful Good'
FROM pemain p WHERE p.username = 'Aragorn_II'
ON CONFLICT DO NOTHING;

INSERT INTO karakter (pemain_id, nama_karakter, race, class, level, max_hp, background, alignment)
SELECT p.id, 'Greenleaf', 'Elf', 'Fighter', 8, 64, 'Noble', 'Chaotic Good'
FROM pemain p WHERE p.username = 'Legolas_Greenleaf'
ON CONFLICT DO NOTHING;

INSERT INTO atribut_stat (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 10, 16, 14, 20, 18, 14
FROM karakter k WHERE k.nama_karakter = 'Mithrandir'
ON CONFLICT DO NOTHING;

INSERT INTO atribut_stat (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 18, 16, 16, 14, 14, 16
FROM karakter k WHERE k.nama_karakter = 'Strider'
ON CONFLICT DO NOTHING;

INSERT INTO atribut_stat (karakter_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
SELECT k.id, 14, 20, 14, 12, 14, 12
FROM karakter k WHERE k.nama_karakter = 'Greenleaf'
ON CONFLICT DO NOTHING;
