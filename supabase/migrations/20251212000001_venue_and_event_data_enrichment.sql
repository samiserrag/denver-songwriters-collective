-- Migration: Venue and Event Data Enrichment
-- Source: Technical Metadata Enrichment Report for Open Mic Events
-- This migration updates venue contact information, addresses, and event scheduling data
-- Confidence levels noted: A (95%+), B (85%), C (70% - requires verification)

-- ============================================================================
-- PART 1: VENUE DATA UPDATES
-- Update existing venues with missing address, phone, website, and ZIP data
-- ============================================================================

-- The Alley (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '2420 West Main Street'),
    city = COALESCE(NULLIF(city, ''), 'Littleton'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80120'),
    phone = COALESCE(phone, '(720) 316-8002'),
    website_url = COALESCE(website_url, 'http://www.littletonalley.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=2420+West+Main+Street+Littleton+CO+80120'),
    contact_link = COALESCE(contact_link, 'events.thealley@gmail.com'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%alley%' AND LOWER(city) = 'littleton';

-- Bar 404 (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '404 N. Broadway'),
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80203'),
    phone = COALESCE(phone, '(720) 379-3141'),
    website_url = COALESCE(website_url, 'https://bar404broadway.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=404+N+Broadway+Denver+CO+80203'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%bar 404%' OR LOWER(name) LIKE '%bar404%';

-- Bootstrap Brewing Company (Confidence: Level B - missing address)
UPDATE venues
SET
    city = COALESCE(NULLIF(city, ''), 'Longmont'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    website_url = COALESCE(website_url, 'https://bootstrapbrewing.com/'),
    notes = COALESCE(notes, '') || ' [DATA GAP: Street address and ZIP needed - high priority]',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%bootstrap%brewing%';

-- Brewery Rickoli (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '4335 Wadsworth Boulevard'),
    city = COALESCE(NULLIF(city, ''), 'Wheat Ridge'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80033'),
    phone = COALESCE(phone, '(303) 344-8988'),
    website_url = COALESCE(website_url, 'https://www.breweryrickoli.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=4335+Wadsworth+Boulevard+Wheat+Ridge+CO+80033'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%rickoli%';

-- Cannonball Creek Brewing Company (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '393 N. Washington Ave.'),
    city = COALESCE(NULLIF(city, ''), 'Golden'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80403'),
    phone = COALESCE(phone, '(303) 278-0111'),
    website_url = COALESCE(website_url, 'http://www.cannonballcreekbrewing.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=393+N+Washington+Ave+Golden+CO+80403'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%cannonball%creek%';

-- Dirty Dogs Roadhouse (Confidence: Level B - missing ZIP)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '17999 West Colfax Avenue'),
    city = COALESCE(NULLIF(city, ''), 'Golden'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    phone = COALESCE(phone, '(303) 384-3644'),
    website_url = COALESCE(website_url, 'https://dirtydogsroadhouse.net/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=17999+West+Colfax+Avenue+Golden+CO'),
    notes = COALESCE(notes, '') || ' [DATA GAP: ZIP code needed]',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%dirty%dogs%';

-- Goosetown Tavern (Confidence: Level C - missing address, needs verification)
UPDATE venues
SET
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    website_url = COALESCE(website_url, 'https://goosetowntavern.com/'),
    notes = COALESCE(notes, '') || ' [DATA GAP: Street address, ZIP, and phone needed - high priority]',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%goosetown%';

-- Green Mountain Beer Company (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '2585 S Lewis Way'),
    city = COALESCE(NULLIF(city, ''), 'Lakewood'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80227'),
    phone = COALESCE(phone, '(303) 986-0201'),
    website_url = COALESCE(website_url, 'https://www.greenmountainbeercompany.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=2585+S+Lewis+Way+Lakewood+CO+80227'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%green%mountain%beer%';

-- Da Sauce (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '2907 Huron St'),
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80202'),
    phone = COALESCE(phone, '(720) 328-8742'),
    website_url = COALESCE(website_url, 'https://dasaucepizza.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=2907+Huron+St+Denver+CO+80202'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%da sauce%' OR LOWER(name) = 'dasauce';

-- Crazy Mountain Brewery (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '1505 North Ogden Street'),
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80218'),
    phone = COALESCE(phone, '(303) 832-3872'),
    website_url = COALESCE(website_url, 'https://crazymountainbrewery.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=1505+North+Ogden+Street+Denver+CO+80218'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%crazy%mountain%';

-- Halftime Sports Bar (Confidence: Level A for address, missing website)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '6051 Quebec St.'),
    city = COALESCE(NULLIF(city, ''), 'Commerce City'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80022'),
    phone = COALESCE(phone, '(303) 288-4253'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=6051+Quebec+St+Commerce+City+CO+80022'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%halftime%';

-- Knotted Root Circular Lounge (Confidence: Level C - missing address)
UPDATE venues
SET
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    website_url = COALESCE(website_url, 'https://www.knottedrootbrewing.com/'),
    notes = COALESCE(notes, '') || ' [DATA GAP: Street address and phone needed - Park Hill neighborhood off East Colfax - high priority]',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%knotted%root%';

-- City O' City (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '206 E 13th Ave.'),
    city = COALESCE(NULLIF(city, ''), 'Denver'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80203'),
    phone = COALESCE(phone, '(303) 831-6443'),
    website_url = COALESCE(website_url, 'https://www.cityocitydenver.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=206+E+13th+Ave+Denver+CO+80203'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%city%o%city%';

-- Da Big Kahuna (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '548 N Lincoln Ave'),
    city = COALESCE(NULLIF(city, ''), 'Loveland'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80537'),
    phone = COALESCE(phone, '(970) 775-7068'),
    website_url = COALESCE(website_url, 'http://www.dabigkahunatikibarandgrill.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=548+N+Lincoln+Ave+Loveland+CO+80537'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%big%kahuna%';

-- Fraco's Bar (Confidence: Level B - missing phone)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '5302 S Federal Cir # A'),
    city = COALESCE(NULLIF(city, ''), 'Littleton'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80123'),
    website_url = COALESCE(website_url, 'https://fracosbar.com/'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=5302+S+Federal+Cir+Littleton+CO+80123'),
    notes = COALESCE(notes, '') || ' [DATA GAP: Phone number needed]',
    updated_at = NOW()
WHERE LOWER(name) LIKE '%fraco%';

-- Cactus Jack's Saloon & Grill (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '4651 County Highway 73'),
    city = COALESCE(NULLIF(city, ''), 'Evergreen'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80439'),
    phone = COALESCE(phone, '(303) 674-1564'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=4651+County+Highway+73+Evergreen+CO+80439'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%cactus%jack%';

-- The Local Drive (Confidence: Level A)
UPDATE venues
SET
    address = COALESCE(NULLIF(address, ''), '2501 Dallas Street'),
    city = COALESCE(NULLIF(city, ''), 'Aurora'),
    state = COALESCE(NULLIF(state, ''), 'CO'),
    zip = COALESCE(zip, '80010'),
    google_maps_url = COALESCE(google_maps_url, 'https://www.google.com/maps/search/?api=1&query=2501+Dallas+Street+Aurora+CO+80010'),
    updated_at = NOW()
WHERE LOWER(name) LIKE '%local%drive%';


-- ============================================================================
-- PART 2: EVENT SCHEDULING UPDATES
-- Update events with signup_time, start_time, end_time, recurrence_rule, day_of_week
-- ============================================================================

-- The Alley - Tuesday Open Mic (Confidence: Level A)
UPDATE events
SET
    signup_time = COALESCE(signup_time, '18:30'),
    start_time = COALESCE(start_time, '19:00'),
    end_time = COALESCE(end_time, '22:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=TU'),
    day_of_week = COALESCE(day_of_week, 'Tuesday'),
    event_type = COALESCE(event_type, 'open_mic'),
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%alley%' AND LOWER(city) = 'littleton')
   OR (LOWER(venue_name) LIKE '%alley%' AND LOWER(COALESCE(venue_address, '')) LIKE '%littleton%');

-- Bootstrap Brewing Company - Monday Open Mic (Confidence: Level A for schedule)
UPDATE events
SET
    signup_time = COALESCE(signup_time, '17:30'),
    start_time = COALESCE(start_time, '18:00'),
    end_time = COALESCE(end_time, '21:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=MO'),
    day_of_week = COALESCE(day_of_week, 'Monday'),
    event_type = COALESCE(event_type, 'open_mic'),
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%bootstrap%brewing%')
   OR LOWER(venue_name) LIKE '%bootstrap%brewing%';

-- Goosetown Tavern - Wednesday Open Mic (Confidence: Level C - schedule needs verification)
UPDATE events
SET
    signup_time = COALESCE(signup_time, '19:00'),
    start_time = COALESCE(start_time, '19:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=WE'),
    day_of_week = COALESCE(day_of_week, 'Wednesday'),
    event_type = COALESCE(event_type, 'open_mic'),
    notes = COALESCE(notes, '') || ' [VERIFY: Wednesday schedule vs Tuesday holiday special]',
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%goosetown%')
   OR LOWER(venue_name) LIKE '%goosetown%';

-- Green Mountain Beer Company - Sunday Open Mic (Confidence: Level A for start, B for end)
UPDATE events
SET
    start_time = COALESCE(start_time, '17:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=SU'),
    day_of_week = COALESCE(day_of_week, 'Sunday'),
    event_type = COALESCE(event_type, 'open_mic'),
    notes = COALESCE(notes, '') || ' [Note: Sign up early in person]',
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%green%mountain%beer%')
   OR LOWER(venue_name) LIKE '%green%mountain%beer%';

-- Knotted Root Circular Lounge - Wednesday Open Mic (Confidence: Level A for schedule)
UPDATE events
SET
    start_time = COALESCE(start_time, '18:00'),
    end_time = COALESCE(end_time, '20:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=WE'),
    day_of_week = COALESCE(day_of_week, 'Wednesday'),
    event_type = COALESCE(event_type, 'open_mic'),
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%knotted%root%')
   OR LOWER(venue_name) LIKE '%knotted%root%';

-- Fraco's Bar - Event times only (no recurrence confirmed)
UPDATE events
SET
    start_time = COALESCE(start_time, '19:00'),
    end_time = COALESCE(end_time, '23:00'),
    event_type = COALESCE(event_type, 'open_mic'),
    notes = COALESCE(notes, '') || ' [DATA GAP: Recurrence rule and day of week needed]',
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%fraco%')
   OR LOWER(venue_name) LIKE '%fraco%';

-- The Local Drive - Thursday Open Mic (Confidence: Level A)
UPDATE events
SET
    start_time = COALESCE(start_time, '18:00'),
    end_time = COALESCE(end_time, '20:00'),
    recurrence_rule = COALESCE(recurrence_rule, 'FREQ=WEEKLY;BYDAY=TH'),
    day_of_week = COALESCE(day_of_week, 'Thursday'),
    event_type = COALESCE(event_type, 'open_mic'),
    updated_at = NOW()
WHERE venue_id IN (SELECT id FROM venues WHERE LOWER(name) LIKE '%local%drive%')
   OR LOWER(venue_name) LIKE '%local%drive%';


-- ============================================================================
-- PART 3: INSERT NEW VENUES (if they don't exist)
-- These venues may not be in the database yet
-- ============================================================================

-- Words Open Mic venue in Colorado Springs (Confidence: Level A)
INSERT INTO venues (name, address, city, state, zip, phone, notes, google_maps_url)
SELECT
    'Words Open Mic Venue',
    '322 N. Tejon',
    'Colorado Springs',
    'CO',
    '80903',
    '(719) 635-7506',
    'Spoken word/poetry/comedy venue. Phone is Visitor Information Center, not direct venue line.',
    'https://www.google.com/maps/search/?api=1&query=322+N+Tejon+Colorado+Springs+CO+80903'
WHERE NOT EXISTS (
    SELECT 1 FROM venues WHERE LOWER(address) LIKE '%322%tejon%' OR LOWER(name) LIKE '%words%open%mic%'
);

-- Create event for Words Open Mic if venue was inserted
INSERT INTO events (title, venue_id, venue_name, venue_address, start_time, end_time, recurrence_rule, day_of_week, event_type, category, notes)
SELECT
    'Words Open Mic',
    v.id,
    v.name,
    v.address || ', ' || v.city || ', ' || v.state || ' ' || v.zip,
    '17:00',
    '20:00',
    'FREQ=MONTHLY;BYDAY=1TU,3TU',
    'Tuesday',
    'open_mic',
    'Spoken Word/Poetry/Comedy',
    'All forms of spoken word - poetry, prose, comedy, story telling. Held 1st and 3rd Tuesday of each month.'
FROM venues v
WHERE (LOWER(v.address) LIKE '%322%tejon%' OR LOWER(v.name) LIKE '%words%open%mic%')
  AND NOT EXISTS (
    SELECT 1 FROM events e WHERE LOWER(e.title) LIKE '%words%open%mic%'
  );


-- ============================================================================
-- PART 4: DATA VALIDATION QUERIES (for manual review)
-- These queries help verify the updates were applied correctly
-- ============================================================================

-- Show venues with data gaps flagged
-- SELECT name, city, address, zip, phone, notes
-- FROM venues
-- WHERE notes LIKE '%DATA GAP%'
-- ORDER BY name;

-- Show venues that were updated in this migration
-- SELECT name, city, address, zip, phone, website_url, updated_at
-- FROM venues
-- WHERE updated_at >= NOW() - INTERVAL '1 minute'
-- ORDER BY name;

-- Show events that were updated in this migration
-- SELECT title, venue_name, start_time, end_time, signup_time, recurrence_rule, day_of_week, updated_at
-- FROM events
-- WHERE updated_at >= NOW() - INTERVAL '1 minute'
-- ORDER BY title;
