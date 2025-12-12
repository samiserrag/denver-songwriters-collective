-- Update Venue Information with Addresses, Phone Numbers, and Websites

-- ===================
-- MONDAY VENUES
-- ===================

-- Cannonball Creek Brewing Company
UPDATE venues SET
  address = '393 N Washington Ave',
  city = 'Golden',
  state = 'CO',
  zip = '80403',
  phone = '(303) 278-0111',
  website_url = 'http://www.cannonballcreekbrewing.com/'
WHERE name ILIKE '%Cannonball Creek%';

-- Insert if not exists
INSERT INTO venues (name, address, city, state, zip, phone, website_url)
SELECT 'Cannonball Creek Brewing Company', '393 N Washington Ave', 'Golden', 'CO', '80403', '(303) 278-0111', 'http://www.cannonballcreekbrewing.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Cannonball Creek%');

-- A-Lodge Lyons / The Rock Garden
UPDATE venues SET
  address = '338 W Main St',
  city = 'Lyons',
  state = 'CO',
  zip = '80540',
  website_url = 'https://www.rockgardenlyons.com/events'
WHERE name ILIKE '%Rock Garden%' OR name ILIKE '%A-Lodge%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'The Rock Garden', '338 W Main St', 'Lyons', 'CO', '80540', 'https://www.rockgardenlyons.com/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Rock Garden%' OR name ILIKE '%A-Lodge%');

-- Bootstrap Brewing Company
UPDATE venues SET
  address = '142 Pratt St',
  city = 'Longmont',
  state = 'CO',
  zip = '80501',
  phone = '(303) 652-4186',
  website_url = 'https://bootstrapbrewing.com/contact/'
WHERE name ILIKE '%Bootstrap%';

INSERT INTO venues (name, address, city, state, zip, phone, website_url)
SELECT 'Bootstrap Brewing Company', '142 Pratt St', 'Longmont', 'CO', '80501', '(303) 652-4186', 'https://bootstrapbrewing.com/contact/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Bootstrap%');

-- Long Table Brewhouse
UPDATE venues SET
  address = '2895 Fairfax St',
  city = 'Denver',
  state = 'CO',
  zip = '80207',
  website_url = 'https://www.lngtbl.com/'
WHERE name ILIKE '%Long Table%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Long Table Brewhouse', '2895 Fairfax St', 'Denver', 'CO', '80207', 'https://www.lngtbl.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Long Table%');

-- Tavern on 26th
UPDATE venues SET
  address = '10040 W 26th Ave',
  city = 'Lakewood',
  state = 'CO',
  zip = '80215',
  phone = '(303) 238-2549',
  website_url = 'https://www.tavernon26th.com/monday-night-musician-open-mic'
WHERE name ILIKE '%Tavern on 26th%';

INSERT INTO venues (name, address, city, state, zip, phone, website_url)
SELECT 'Tavern on 26th', '10040 W 26th Ave', 'Lakewood', 'CO', '80215', '(303) 238-2549', 'https://www.tavernon26th.com/monday-night-musician-open-mic'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Tavern on 26th%');

-- Kiln Coworking (Listening Room)
UPDATE venues SET
  address = '2650 W Main St',
  city = 'Littleton',
  state = 'CO',
  zip = '80120'
WHERE name ILIKE '%Kiln%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Kiln Coworking', '2650 W Main St', 'Littleton', 'CO', '80120'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Kiln%');

-- Mozart's Lounge
UPDATE venues SET
  address = '1417 Kramer Ct',
  city = 'Denver',
  state = 'CO',
  zip = '80220'
WHERE name ILIKE '%Mozart%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Mozart''s Lounge', '1417 Kramer Ct', 'Denver', 'CO', '80220'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Mozart%');

-- The Corner Beet
UPDATE venues SET
  address = '1401 Ogden St',
  city = 'Denver',
  state = 'CO',
  zip = '80218',
  website_url = 'https://cornerbeet.com/denver-capitol-hill-the-corner-beet-events'
WHERE name ILIKE '%Corner Beet%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'The Corner Beet', '1401 Ogden St', 'Denver', 'CO', '80218', 'https://cornerbeet.com/denver-capitol-hill-the-corner-beet-events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Corner Beet%');

-- Full House Sports Bar
UPDATE venues SET
  address = '4272 S Broadway',
  city = 'Englewood',
  state = 'CO',
  zip = '80113',
  phone = '(720) 485-4494'
WHERE name ILIKE '%Full House%';

INSERT INTO venues (name, address, city, state, zip, phone)
SELECT 'Full House Sports Bar & Grill', '4272 S Broadway', 'Englewood', 'CO', '80113', '(720) 485-4494'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Full House%');

-- ===================
-- TUESDAY VENUES
-- ===================

-- Blazin Bite Seafood BBQ
UPDATE venues SET
  address = '2600 S Parker Rd',
  city = 'Aurora',
  state = 'CO',
  zip = '80014'
WHERE name ILIKE '%Blazin Bite%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Blazin Bite Seafood BBQ', '2600 S Parker Rd', 'Aurora', 'CO', '80014'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Blazin Bite%');

-- Brewery Rickoli
UPDATE venues SET
  address = '4335 Wadsworth Blvd',
  city = 'Wheat Ridge',
  state = 'CO',
  zip = '80033',
  website_url = 'https://www.breweryrickoli.com/'
WHERE name ILIKE '%Rickoli%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Brewery Rickoli', '4335 Wadsworth Blvd', 'Wheat Ridge', 'CO', '80033', 'https://www.breweryrickoli.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Rickoli%');

-- Goosetown Tavern
UPDATE venues SET
  address = '3242 E Colfax Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80206',
  website_url = 'http://www.goosetowntavern.com/'
WHERE name ILIKE '%Goosetown%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Goosetown Tavern', '3242 E Colfax Ave', 'Denver', 'CO', '80206', 'http://www.goosetowntavern.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Goosetown%');

-- Roots Music Project
UPDATE venues SET
  address = '4747 Pearl Suite V3A',
  city = 'Boulder',
  state = 'CO',
  zip = '80301',
  website_url = 'https://www.rootsmusicproject.org/calendar'
WHERE name ILIKE '%Roots Music%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Roots Music Project', '4747 Pearl Suite V3A', 'Boulder', 'CO', '80301', 'https://www.rootsmusicproject.org/calendar'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Roots Music%');

-- Dry Dock Brewing - South Dock
UPDATE venues SET
  address = '15120 E Hampden Ave',
  city = 'Aurora',
  state = 'CO',
  zip = '80014'
WHERE name ILIKE '%Dry Dock%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Dry Dock Brewing Co - South Dock', '15120 E Hampden Ave', 'Aurora', 'CO', '80014'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Dry Dock%');

-- Knotted Root - Circular Lounge
UPDATE venues SET
  address = '2500 W 2nd Ave Unit 13',
  city = 'Denver',
  state = 'CO',
  zip = '80219'
WHERE name ILIKE '%Knotted Root%' OR name ILIKE '%Circular Lounge%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Knotted Root - Circular Lounge', '2500 W 2nd Ave Unit 13', 'Denver', 'CO', '80219'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Knotted Root%' OR name ILIKE '%Circular Lounge%');

-- Bar 404
UPDATE venues SET
  address = '404 Broadway',
  city = 'Denver',
  state = 'CO',
  zip = '80203',
  website_url = 'https://bar404broadway.com/'
WHERE name ILIKE '%Bar 404%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Bar 404', '404 Broadway', 'Denver', 'CO', '80203', 'https://bar404broadway.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Bar 404%');

-- ===================
-- WEDNESDAY VENUES
-- ===================

-- Lion's Lair
UPDATE venues SET
  address = '2022 E Colfax Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80206',
  website_url = 'https://www.lionslairco.com/events'
WHERE name ILIKE '%Lion%Lair%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Lion''s Lair', '2022 E Colfax Ave', 'Denver', 'CO', '80206', 'https://www.lionslairco.com/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Lion%Lair%');

-- Lincoln's Roadhouse
UPDATE venues SET
  address = '1201 S Pearl St',
  city = 'Denver',
  state = 'CO',
  zip = '80210',
  website_url = 'http://www.lincolnsroadhouse.com/'
WHERE name ILIKE '%Lincoln%Roadhouse%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Lincoln''s Roadhouse', '1201 S Pearl St', 'Denver', 'CO', '80210', 'http://www.lincolnsroadhouse.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Lincoln%Roadhouse%');

-- FlyteCo Tower
UPDATE venues SET
  address = '3120 Uinta St',
  city = 'Denver',
  state = 'CO',
  zip = '80238',
  website_url = 'https://flytecotower.com/events'
WHERE name ILIKE '%FlyteCo%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'FlyteCo Tower', '3120 Uinta St', 'Denver', 'CO', '80238', 'https://flytecotower.com/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%FlyteCo%');

-- Two Moons Music Hall
UPDATE venues SET
  address = '2944 Larimer St',
  city = 'Denver',
  state = 'CO',
  zip = '80205',
  website_url = 'https://www.twomoonsmusic.com/events-list'
WHERE name ILIKE '%Two Moons%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Two Moons Music Hall', '2944 Larimer St', 'Denver', 'CO', '80205', 'https://www.twomoonsmusic.com/events-list'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Two Moons%');

-- Same Cafe
UPDATE venues SET
  address = '2023 E Colfax Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80206',
  website_url = 'https://www.soallmayeat.org/denver/events'
WHERE name ILIKE '%Same Cafe%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Same Cafe', '2023 E Colfax Ave', 'Denver', 'CO', '80206', 'https://www.soallmayeat.org/denver/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Same Cafe%');

-- Bodega Beer Company
UPDATE venues SET
  address = '2038 W 33rd Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80211'
WHERE name ILIKE '%Bodega Beer%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Bodega Beer Company', '2038 W 33rd Ave', 'Denver', 'CO', '80211'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Bodega Beer%');

-- Second Dawn Brewing
UPDATE venues SET
  address = '2302 Dayton St',
  city = 'Aurora',
  state = 'CO',
  zip = '80010'
WHERE name ILIKE '%Second Dawn%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Second Dawn Brewing', '2302 Dayton St', 'Aurora', 'CO', '80010'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Second Dawn%');

-- ===================
-- THURSDAY VENUES
-- ===================

-- Rails End Beer Company
UPDATE venues SET
  address = '11625 Reed Ct B',
  city = 'Broomfield',
  state = 'CO',
  zip = '80020',
  website_url = 'https://railsendbeerco.com/live-music/'
WHERE name ILIKE '%Rails End%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Rails End Beer Company', '11625 Reed Ct B', 'Broomfield', 'CO', '80020', 'https://railsendbeerco.com/live-music/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Rails End%');

-- Schoolhouse Kitchen
UPDATE venues SET
  address = '5660 Olde Wadsworth Blvd',
  city = 'Arvada',
  state = 'CO',
  zip = '80002',
  website_url = 'https://www.schoolhousemenu.com/events'
WHERE name ILIKE '%Schoolhouse%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Schoolhouse Kitchen', '5660 Olde Wadsworth Blvd', 'Arvada', 'CO', '80002', 'https://www.schoolhousemenu.com/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Schoolhouse%');

-- Woodcellar
UPDATE venues SET
  address = '1552 Bergen Pkwy',
  city = 'Evergreen',
  state = 'CO',
  zip = '80439',
  website_url = 'https://www.openmicdenver.com/MoreInfo/NjI2NiMjIyNURVhU'
WHERE name ILIKE '%Woodcellar%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Woodcellar', '1552 Bergen Pkwy', 'Evergreen', 'CO', '80439', 'https://www.openmicdenver.com/MoreInfo/NjI2NiMjIyNURVhU'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Woodcellar%');

-- Cactus Jack's Saloon & Grill
UPDATE venues SET
  address = '4651 Hwy 73',
  city = 'Evergreen',
  state = 'CO',
  zip = '80439',
  website_url = 'https://downtownevergreen.com/do/jonathans-open-mic-night'
WHERE name ILIKE '%Cactus Jack%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Cactus Jack''s Saloon & Grill', '4651 Hwy 73', 'Evergreen', 'CO', '80439', 'https://downtownevergreen.com/do/jonathans-open-mic-night'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Cactus Jack%');

-- City O' City
UPDATE venues SET
  address = '206 E 13th Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80203'
WHERE name ILIKE '%City O%City%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'City O'' City', '206 E 13th Ave', 'Denver', 'CO', '80203'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%City O%City%');

-- Swallow Hill Music
UPDATE venues SET
  address = '71 E Yale Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80210',
  website_url = 'https://swallowhillmusic.org/jams/'
WHERE name ILIKE '%Swallow Hill%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Swallow Hill Music', '71 E Yale Ave', 'Denver', 'CO', '80210', 'https://swallowhillmusic.org/jams/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Swallow Hill%');

-- ===================
-- FRIDAY VENUES
-- ===================

-- Denver Art Society
UPDATE venues SET
  address = '734 Santa Fe Dr',
  city = 'Denver',
  state = 'CO',
  zip = '80204',
  website_url = 'https://www.meetup.com/denver-art-societ/'
WHERE name ILIKE '%Denver Art Society%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Denver Art Society', '734 Santa Fe Dr', 'Denver', 'CO', '80204', 'https://www.meetup.com/denver-art-societ/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Denver Art Society%');

-- Youth on Record
UPDATE venues SET
  address = '1301 W 10th Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80204',
  website_url = 'https://www.artsandvenuesdenver.com/events/detail/youth-on-record-open-mic-2'
WHERE name ILIKE '%Youth on Record%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Youth on Record', '1301 W 10th Ave', 'Denver', 'CO', '80204', 'https://www.artsandvenuesdenver.com/events/detail/youth-on-record-open-mic-2'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Youth on Record%');

-- ===================
-- SATURDAY VENUES
-- ===================

-- Roostercat Coffee House
UPDATE venues SET
  address = '1045 Lincoln St',
  city = 'Denver',
  state = 'CO',
  zip = '80203',
  website_url = 'https://www.roostercatdenver.com/events'
WHERE name ILIKE '%Roostercat%' OR name ILIKE '%Boostercat%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Roostercat Coffee House', '1045 Lincoln St', 'Denver', 'CO', '80203', 'https://www.roostercatdenver.com/events'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Roostercat%' OR name ILIKE '%Boostercat%');

-- Lone Tree Brewing
UPDATE venues SET
  address = '8200 Park Meadows Dr #8222',
  city = 'Lone Tree',
  state = 'CO',
  zip = '80124'
WHERE name ILIKE '%Lone Tree%';

INSERT INTO venues (name, address, city, state, zip)
SELECT 'Lone Tree Brewing', '8200 Park Meadows Dr #8222', 'Lone Tree', 'CO', '80124'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Lone Tree%');

-- ===================
-- SUNDAY VENUES
-- ===================

-- Green Mountain Beer Company
UPDATE venues SET
  address = '2585 S Lewis Way',
  city = 'Lakewood',
  state = 'CO',
  zip = '80227',
  website_url = 'https://www.greenmountainbeercompany.com/'
WHERE name ILIKE '%Green Mountain%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Green Mountain Beer Company', '2585 S Lewis Way', 'Lakewood', 'CO', '80227', 'https://www.greenmountainbeercompany.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Green Mountain%');

-- Mercury Cafe
UPDATE venues SET
  address = '2199 California St',
  city = 'Denver',
  state = 'CO',
  zip = '80205',
  website_url = 'http://www.mercurycafe.com/'
WHERE name ILIKE '%Mercury Cafe%';

INSERT INTO venues (name, address, city, state, zip, website_url)
SELECT 'Mercury Cafe', '2199 California St', 'Denver', 'CO', '80205', 'http://www.mercurycafe.com/'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Mercury Cafe%');

-- Squire Lounge
UPDATE venues SET
  address = '1800 E Colfax Ave',
  city = 'Denver',
  state = 'CO',
  zip = '80218',
  phone = '(303) 333-9106'
WHERE name ILIKE '%Squire Lounge%';

INSERT INTO venues (name, address, city, state, zip, phone)
SELECT 'Squire Lounge', '1800 E Colfax Ave', 'Denver', 'CO', '80218', '(303) 333-9106'
WHERE NOT EXISTS (SELECT 1 FROM venues WHERE name ILIKE '%Squire Lounge%');
