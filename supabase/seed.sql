-- Seed data for local development
-- This file creates test data for studios, performers, events, and services

-- 1. Create a studio profile
INSERT INTO profiles (id, full_name, role, bio)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'Golden Sound Studio',
  'studio',
  'Professional recording studio in Denver.'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Add a service for Golden Sound Studio
INSERT INTO studio_services (id, studio_id, name, description, duration_min, price_cents)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  '1-Hour Recording Session',
  'Professional tracking with engineer included.',
  60,
  8000
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create a performer profile
INSERT INTO profiles (id, full_name, role, bio)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  'Sarah Mitchell',
  'performer',
  'Singer-songwriter from Denver.'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Create an event
INSERT INTO events (id, title, event_date, start_time, venue_name, venue_address)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  'Friday Night Open Mic',
  CURRENT_DATE + 7,
  '19:00',
  'The Bluebird Cafe',
  '123 Main St, Denver CO'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Create additional performers for spotlight testing
INSERT INTO profiles (id, full_name, role, bio, is_featured, featured_rank)
VALUES
  (
    '55555555-5555-5555-5555-555555555555',
    'Jake Anderson',
    'performer',
    'Blues guitarist and vocalist.',
    true,
    1
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'Emily Chen',
    'performer',
    'Indie folk songwriter.',
    true,
    2
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'Marcus Rivera',
    'performer',
    'Country and Americana artist.',
    false,
    9999
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Create additional studios
INSERT INTO profiles (id, full_name, role, bio, is_featured, featured_rank)
VALUES
  (
    '88888888-8888-8888-8888-888888888888',
    'Mile High Recording',
    'studio',
    'Full-service production studio with vintage gear.',
    true,
    1
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'The Vault Studios',
    'studio',
    'Boutique recording space in the heart of Denver.',
    false,
    9999
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Add services for additional studios
INSERT INTO studio_services (id, studio_id, name, description, duration_min, price_cents)
VALUES
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '88888888-8888-8888-8888-888888888888',
    'Half-Day Session',
    'Four hours of recording time with engineer.',
    240,
    30000
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '88888888-8888-8888-8888-888888888888',
    'Mixing Service',
    'Professional mixing for one song.',
    120,
    15000
  ),
  (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '99999999-9999-9999-9999-999999999999',
    'Demo Package',
    'Record up to 3 songs in one day.',
    480,
    50000
  )
ON CONFLICT (id) DO NOTHING;

-- 8. Create additional events
INSERT INTO events (id, title, event_date, start_time, venue_name, venue_address, description, is_featured, featured_rank)
VALUES
  (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'Songwriter Showcase',
    CURRENT_DATE + 14,
    '20:00',
    'Herman''s Hideaway',
    '1578 S Broadway, Denver CO',
    'Monthly showcase featuring local songwriters.',
    true,
    1
  ),
  (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'Acoustic Brunch',
    CURRENT_DATE + 3,
    '11:00',
    'Avanti F&B',
    '3200 Pecos St, Denver CO',
    'Sunday morning acoustic performances.',
    false,
    9999
  ),
  (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'Open Mic Night - RiNo',
    CURRENT_DATE + 5,
    '19:30',
    'Ratio Beerworks',
    '2920 Larimer St, Denver CO',
    'Open mic in the RiNo Art District.',
    true,
    2
  )
ON CONFLICT (id) DO NOTHING;
