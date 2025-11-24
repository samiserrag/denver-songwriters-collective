-- ==========================================================
-- OPEN MIC DROP — PHASE 1 SCHEMA
-- Matches RLS policies exactly
-- ==========================================================

-- UUID extension (usually enabled but safe to call)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================================
-- ENUMS (safer than text fields)
-- ==========================================================

CREATE TYPE user_role AS ENUM ('performer', 'host', 'studio', 'admin');
CREATE TYPE appointment_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');

-- ==========================================================
-- 1. PROFILES TABLE
-- ==========================================================

CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT auth.uid(),
  full_name     TEXT,
  role          user_role NOT NULL DEFAULT 'performer',
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX profiles_id_idx ON profiles(id);

-- ==========================================================
-- 2. EVENTS TABLE
-- ==========================================================

CREATE TABLE events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  venue_name    TEXT,
  venue_address TEXT,
  event_date    DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  is_showcase   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX events_host_idx ON events(host_id);

-- ==========================================================
-- 3. EVENT_SLOTS TABLE
-- ==========================================================

CREATE TABLE event_slots (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  performer_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  slot_index    INT NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(event_id, slot_index)
);

CREATE INDEX event_slots_event_idx ON event_slots(event_id);

-- ==========================================================
-- 4. STUDIO_SERVICES TABLE
-- ==========================================================

CREATE TABLE studio_services (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  studio_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  price_cents   INTEGER NOT NULL,
  duration_min  INTEGER NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX studio_services_studio_idx ON studio_services(studio_id);

-- ==========================================================
-- 5. STUDIO_APPOINTMENTS TABLE
-- ==========================================================

CREATE TABLE studio_appointments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id    UUID NOT NULL REFERENCES studio_services(id) ON DELETE CASCADE,
  performer_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  appointment_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status        appointment_status NOT NULL DEFAULT 'pending',
  note          TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX studio_appt_service_idx ON studio_appointments(service_id);
CREATE INDEX studio_appt_performer_idx ON studio_appointments(performer_id);

-- ==========================================================
-- 6. SPOTLIGHTS TABLE
-- ==========================================================

CREATE TABLE spotlights (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  spotlight_date DATE NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX spotlights_artist_idx ON spotlights(artist_id);

-- ==========================================================
-- END OF PHASE 1 SCHEMA
-- ==========================================================