-- Update Open Mic Events with Verified Information
-- Status: active, inactive, unverified

-- ===================
-- MONDAY OPEN MICS
-- ===================

-- Cannonball Creek Open Mic - INACTIVE/UNCERTAIN
UPDATE events SET
  status = 'inactive',
  description = 'Current December 2025 calendar lists food trucks on Mondays, but does not explicitly list an Open Mic event. Status uncertain - verify with venue.'
WHERE title ILIKE '%Cannonball Creek%' AND event_type = 'open_mic';

-- Lyons Rock Garden - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Verified as recently as Oct 2024. Hosted by Saidman Said. Weekly open mic at The Rock Garden in Lyons.',
  signup_time = NULL
WHERE title ILIKE '%Lyons Rock Garden%' OR (title ILIKE '%Rock Garden%' AND venue_name ILIKE '%Lyons%');

-- Bootstrap Brewing Open Mic - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Online sign-up available (Google Form) or in-person. Runs 6:00 PM - 9:00 PM.',
  start_time = '18:00',
  end_time = '21:00'
WHERE title ILIKE '%Bootstrap%' AND event_type = 'open_mic';

-- Long Table Brewhouse - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Monday Blues & Rock Jam. Sign-up at 5:00 PM.',
  signup_time = '17:00'
WHERE title ILIKE '%Long Table%' AND event_type = 'open_mic';

-- Tavern on 26th - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Monday Night Musician Open Mic. Sign-up at 6:30 PM. Hosted by Matt and Holli.',
  signup_time = '18:30'
WHERE title ILIKE '%Tavern on 26th%' AND event_type = 'open_mic';

-- Listening Room (Kiln Coworking) - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Requires checking with venue. Kiln is a coworking space that often hosts private/community events. 2nd Monday of the month.'
WHERE title ILIKE '%Listening Room%' AND event_type = 'open_mic';

-- Mozart's First Monday Open Mic - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Mozart''s Denver typically refers to Mozart''s Lounge (Denver/Lowry). Mozart''s Coffee (Austin) is famous for open mics, creating search confusion. Verify with venue.'
WHERE title ILIKE '%Mozart%' AND event_type = 'open_mic';

-- The Corner Beet - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Monday Open Mic featuring Music, Poetry, and Comedy. Doors open at 6:00 PM for sign-up.',
  signup_time = '18:00'
WHERE title ILIKE '%Corner Beet%' AND event_type = 'open_mic';

-- Full House Sports Bar - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Website lists daily food specials but does not currently list an Open Mic on the calendar. Seasonal event - verify with venue.'
WHERE title ILIKE '%Full House%' AND event_type = 'open_mic';

-- ===================
-- TUESDAY OPEN MICS
-- ===================

-- Blazin Bite Seafood - UNCERTAIN
UPDATE events SET
  status = 'unverified',
  description = 'Some sources list Comedy Night on specific dates, but venue hours on Google often show Closed on Tuesdays. Verify current schedule with venue.'
WHERE title ILIKE '%Blazin Bite%' AND event_type = 'open_mic';

-- Brewery Rickoli - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Verified open mic nights. Recent reviews mention every Tuesday, though some sources say every other Tuesday. Check current schedule.'
WHERE title ILIKE '%Rickoli%' AND event_type = 'open_mic';

-- Goosetown Tavern - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Sign-up at 7:00 PM, music starts at 8:00 PM. Every Tuesday.',
  signup_time = '19:00',
  start_time = '20:00'
WHERE title ILIKE '%Goosetown%' AND event_type = 'open_mic';

-- Roots Music Project - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Check specific dates on their calendar as they often host ticketed shows alongside the open mic.'
WHERE title ILIKE '%Roots Music%' AND event_type = 'open_mic';

-- Dry Dock Brewing - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = '2023 events listed South Dock open mics. Current 2025 calendar does not explicitly show recurring Open Mic Tuesdays. Verify with venue.'
WHERE title ILIKE '%Dry Dock%' AND event_type = 'open_mic';

-- Circular Lounge / Knotted Root - CONFLICTING INFO
UPDATE events SET
  status = 'unverified',
  description = 'Conflicting information: Some listings say Tuesday Closed, others list Open Mic on Wednesdays (e.g., Aug 2024). Verify current schedule.'
WHERE (title ILIKE '%Circular Lounge%' OR title ILIKE '%Knotted Root%') AND event_type = 'open_mic';

-- Bar 404 Blues Jam - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Open Blues Jam on 2nd & 4th Tuesdays. Verify current schedule with venue.'
WHERE title ILIKE '%Bar 404%' AND event_type = 'open_mic';

-- ===================
-- WEDNESDAY OPEN MICS
-- ===================

-- Lion's Lair - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Sign-up at 8:00 PM, music starts at 9:00 PM. Doors open at 7:00 PM. Every Wednesday.',
  signup_time = '20:00',
  start_time = '21:00'
WHERE title ILIKE '%Lion''s Lair%' OR title ILIKE '%Lions Lair%' AND event_type = 'open_mic';

-- Lincoln's Roadhouse - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Hosted by Jon Steideman. Every Wednesday at 7:00 PM.'
WHERE title ILIKE '%Lincoln%Roadhouse%' AND event_type = 'open_mic';

-- FlyteCo Tower - ACTIVE/IRREGULAR
UPDATE events SET
  status = 'active',
  description = 'Calendar shows specific dates - appears to be 1st & 3rd Wednesdays. Check their events calendar for exact dates.',
  recurrence_rule = 'FREQ=MONTHLY;BYDAY=1WE,3WE'
WHERE title ILIKE '%FlyteCo%' AND event_type = 'open_mic';

-- Two Moons - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Hosted by Jake Neiderhauser. Sign-up at 6:00 PM. 1st Wednesday of the month.',
  signup_time = '18:00'
WHERE title ILIKE '%Two Moons%' AND event_type = 'open_mic';

-- Same Cafe - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'So All May Express Open Mic. Sign-up/Dinner at 6:00 PM, music starts at 6:30 PM. 3rd Wednesday of the month.',
  signup_time = '18:00',
  start_time = '18:30'
WHERE title ILIKE '%Same Cafe%' AND event_type = 'open_mic';

-- Bodega Beer - AMBIGUOUS
UPDATE events SET
  status = 'unverified',
  description = 'Events page lists Open Mic Night but description references Fiction Beer Parker. Verify location directly with venue.'
WHERE title ILIKE '%Bodega Beer%' AND event_type = 'open_mic';

-- Second Dawn - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Some listings show Open Mic Night on Fridays (e.g., Aug 2025). Check current schedule with venue.'
WHERE title ILIKE '%Second Dawn%' AND event_type = 'open_mic';

-- ===================
-- THURSDAY OPEN MICS
-- ===================

-- Rails End - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Online sign-up available. Runs 6:00 PM - 10:00 PM. 3rd Thursday of the month.',
  start_time = '18:00',
  end_time = '22:00'
WHERE title ILIKE '%Rails End%' AND event_type = 'open_mic';

-- Schoolhouse Kitchen - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Hosted by Michael Allen. Sign-up at 5:30 PM. 2nd Thursday of the month.',
  signup_time = '17:30'
WHERE title ILIKE '%Schoolhouse%' AND event_type = 'open_mic';

-- Woodcellar - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Hosted by Andy Potter. Sign-up at 6:45 PM. 1st & 3rd Thursdays.',
  signup_time = '18:45',
  recurrence_rule = 'FREQ=MONTHLY;BYDAY=1TH,3TH'
WHERE title ILIKE '%Woodcellar%' AND event_type = 'open_mic';

-- Cactus Jack's - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Hosted by Jonathan. Frequency varies by season - twice a month or every Thursday. Verify current schedule.'
WHERE title ILIKE '%Cactus Jack%' AND event_type = 'open_mic';

-- City O' City - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Artists page mentions Monthly Art Rotations on 1st Monday, but no recent confirmation of Thursday Open Mic. Verify with venue.'
WHERE title ILIKE '%City O'' City%' OR title ILIKE '%City O City%' AND event_type = 'open_mic';

-- Swallow Hill - CHANGED
UPDATE events SET
  status = 'active',
  description = 'Note: Swallow Hill currently hosts specific Jams (Bluegrass, Irish, Old-Time) on weekends/Thursdays rather than a traditional Open Stage format. Check their jams schedule.'
WHERE title ILIKE '%Swallow Hill%' AND event_type = 'open_mic';

-- ===================
-- FRIDAY OPEN MICS
-- ===================

-- Denver Art Society - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Sign-up at 6:30 PM. Hosted by Charles Levesque and Uriah Higgins. 2nd Friday of the month.',
  signup_time = '18:30'
WHERE title ILIKE '%Denver Art Society%' AND event_type = 'open_mic';

-- Youth on Record - ACTIVE/SEASONAL
UPDATE events SET
  status = 'active',
  description = 'Sign-up at 4:00 PM, show runs 5:00 PM - 8:00 PM. 1st Friday of the month. May be seasonal.',
  signup_time = '16:00',
  start_time = '17:00',
  end_time = '20:00'
WHERE title ILIKE '%Youth on Record%' AND event_type = 'open_mic';

-- ===================
-- SATURDAY OPEN MICS
-- ===================

-- Roostercat Coffee (formerly listed as Boostercat) - ACTIVE
UPDATE events SET
  status = 'active',
  title = 'Roostercat Coffee Open Mic',
  description = 'Sign-up at 6:30 PM. Every Saturday.',
  signup_time = '18:30'
WHERE title ILIKE '%Boostercat%' OR title ILIKE '%Roostercat%' AND event_type = 'open_mic';

-- Lone Tree Brewing - INACTIVE
UPDATE events SET
  status = 'inactive',
  description = 'Current calendar lists Trivia (Thursdays) and Run Club (Mondays), but no Open Mic on Saturdays. May be discontinued.'
WHERE title ILIKE '%Lone Tree%' AND event_type = 'open_mic';

-- ===================
-- SUNDAY OPEN MICS
-- ===================

-- Green Mountain Beer Company - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Open Mic Sunday. Sign-up in-person (show up early). Occasional host: Bill Moore. Every Sunday at 5:00 PM.'
WHERE title ILIKE '%Green Mountain%' OR title ILIKE '%GMBC%' AND event_type = 'open_mic';

-- Mercury Cafe - ACTIVE
UPDATE events SET
  status = 'active',
  description = 'Multiple events: Jam Before the Slam (6 PM), Open Mic Poetry (8 PM), Poetry Slam (9 PM). Every Sunday.'
WHERE title ILIKE '%Mercury Cafe%' AND event_type = 'open_mic';

-- Squire Lounge - UNVERIFIED
UPDATE events SET
  status = 'unverified',
  description = 'Every Sunday at 8:00 PM. Verify current schedule with venue.'
WHERE title ILIKE '%Squire Lounge%' AND event_type = 'open_mic';
