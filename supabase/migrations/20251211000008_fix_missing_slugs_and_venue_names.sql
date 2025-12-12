-- Fix missing slugs and venue names for events
-- Generated from data quality audit on 2025-12-11

-- First, let's update the events missing venue_name by looking up from venues table
UPDATE events e
SET venue_name = v.name
FROM venues v
WHERE e.venue_id = v.id
  AND (e.venue_name IS NULL OR e.venue_name = '');

-- Now generate slugs for all events missing them
-- Format: title-city-shortid (lowercase, alphanumeric + hyphens)

-- The Alley (missing both slug and venue_name)
UPDATE events SET
  slug = 'the-alley-' || substring(id::text, 1, 8),
  venue_name = COALESCE(venue_name, 'The Alley')
WHERE id = '4f99b2a4-e7b4-4eba-98cd-54c926f5199d' AND slug IS NULL;

-- Scully's Cafe (missing both slug and venue_name)
UPDATE events SET
  slug = 'scullys-cafe-' || substring(id::text, 1, 8),
  venue_name = COALESCE(venue_name, 'Scully''s Cafe')
WHERE id = 'b2c01b7d-d024-4818-98e3-1f249de22859' AND slug IS NULL;

-- Test Circle
UPDATE events SET slug = 'test-circle-' || substring(id::text, 1, 8)
WHERE id = 'be58ba95-a27b-44ab-8e1f-164d6a1a074c' AND slug IS NULL;

-- Song Critique Circle Test 1
UPDATE events SET slug = 'song-critique-circle-test-1-' || substring(id::text, 1, 8)
WHERE id = '4fdb2983-7f90-4c9e-b41c-28c943195a91' AND slug IS NULL;

-- Lone Tree Brewing
UPDATE events SET slug = 'lone-tree-brewing-' || substring(id::text, 1, 8)
WHERE id = '969c6759-47f8-45e3-9540-d51484cdf4aa' AND slug IS NULL;

-- Youth on Record
UPDATE events SET slug = 'youth-on-record-' || substring(id::text, 1, 8)
WHERE id = '4b236967-345a-4f72-b4a8-2045b8becb70' AND slug IS NULL;

-- The Pearl - Poetry
UPDATE events SET slug = 'the-pearl-poetry-' || substring(id::text, 1, 8)
WHERE id = 'bc7e35f7-1c0f-4e4b-8a2e-b22a4b7abc3b' AND slug IS NULL;

-- Halfpenny Brewing
UPDATE events SET slug = 'halfpenny-brewing-' || substring(id::text, 1, 8)
WHERE id = 'e6038d56-0eab-4771-a772-21611e95d1fd' AND slug IS NULL;

-- Brewability / Pizzability
UPDATE events SET slug = 'brewability-pizzability-' || substring(id::text, 1, 8)
WHERE id = 'cd4b75fd-9306-49aa-8ae9-2c764807d062' AND slug IS NULL;

-- Mercury Cafe After-Slam
UPDATE events SET slug = 'mercury-cafe-after-slam-' || substring(id::text, 1, 8)
WHERE id = '12893664-44a9-482c-b832-920138b94ceb' AND slug IS NULL;

-- Western Sky
UPDATE events SET slug = 'western-sky-' || substring(id::text, 1, 8)
WHERE id = '26c1d81b-7571-4921-93f4-859605db950f' AND slug IS NULL;

-- Rails End
UPDATE events SET slug = 'rails-end-' || substring(id::text, 1, 8)
WHERE id = 'e08bb476-6641-4eb2-bad9-bd7bc1f918fb' AND slug IS NULL;

-- Roostercat Coffee
UPDATE events SET slug = 'roostercat-coffee-' || substring(id::text, 1, 8)
WHERE id = '09f60234-5a64-4fa5-8525-02d9633eb64c' AND slug IS NULL;

-- Same Cafe
UPDATE events SET slug = 'same-cafe-' || substring(id::text, 1, 8)
WHERE id = '1a1c4bb9-9dfc-4e19-a0dc-630235f9dc1c' AND slug IS NULL;

-- Schoolhouse Kitchen
UPDATE events SET slug = 'schoolhouse-kitchen-' || substring(id::text, 1, 8)
WHERE id = '12700c6b-a1ce-4edd-8aef-7deb5a70b792' AND slug IS NULL;

-- Second Dawn (first instance)
UPDATE events SET slug = 'second-dawn-' || substring(id::text, 1, 8)
WHERE id = '2bc54f30-8979-4352-bf54-807db24544ad' AND slug IS NULL;

-- Second Dawn (second instance)
UPDATE events SET slug = 'second-dawn-' || substring(id::text, 1, 8)
WHERE id = '142f973d-50f1-4c30-990b-f74c2178cdec' AND slug IS NULL;

-- Goosetown Tavern
UPDATE events SET slug = 'goosetown-tavern-' || substring(id::text, 1, 8)
WHERE id = '7408c379-ed5a-40d2-bcf0-8e838e579ad3' AND slug IS NULL;

-- Knotted Root Circular Lounge
UPDATE events SET slug = 'knotted-root-circular-lounge-' || substring(id::text, 1, 8)
WHERE id = '8aa2f23a-2933-4f49-aa5c-1b6984073f29' AND slug IS NULL;

-- Node Arts Collective
UPDATE events SET slug = 'node-arts-collective-' || substring(id::text, 1, 8)
WHERE id = '34f74376-e042-4b10-a7af-ed1a9f128f39' AND slug IS NULL;

-- Da Sauce Open Stage & Karaoke
UPDATE events SET slug = 'da-sauce-open-stage-karaoke-' || substring(id::text, 1, 8)
WHERE id = '2919ea10-ff71-40b0-b4e0-535ea0f2f47b' AND slug IS NULL;

-- Pete's Satire Lounge
UPDATE events SET slug = 'petes-satire-lounge-' || substring(id::text, 1, 8)
WHERE id = '03c9f09d-b07b-476d-9bb6-de57a86bef4a' AND slug IS NULL;

-- Velvet Banjo
UPDATE events SET slug = 'velvet-banjo-' || substring(id::text, 1, 8)
WHERE id = '1a6e82a2-ca98-49ac-82c2-e69d7efeb622' AND slug IS NULL;

-- Woodcellar
UPDATE events SET slug = 'woodcellar-' || substring(id::text, 1, 8)
WHERE id = 'cf99cd34-4981-4d22-9b18-8e831b0c285c' AND slug IS NULL;

-- Zymos Brewing
UPDATE events SET slug = 'zymos-brewing-' || substring(id::text, 1, 8)
WHERE id = '6b9acb2a-72e9-4569-910f-bfdd77526e98' AND slug IS NULL;

-- Open Mic with Antonio Lopez
UPDATE events SET slug = 'open-mic-antonio-lopez-' || substring(id::text, 1, 8)
WHERE id = '0453cb9e-cdba-4de2-8161-136e6c59d62e' AND slug IS NULL;

-- Listening Room (mobile series)
UPDATE events SET slug = 'listening-room-mobile-' || substring(id::text, 1, 8)
WHERE id = '73bb86f8-0160-415f-ae90-0a3555eacfe4' AND slug IS NULL;

-- Mozart's First Monday
UPDATE events SET slug = 'mozarts-first-monday-' || substring(id::text, 1, 8)
WHERE id = 'bec1d033-1d38-46e5-bd8b-0544ea20ce1f' AND slug IS NULL;

-- Bar 404 Open (Blues) Jam
UPDATE events SET slug = 'bar-404-blues-jam-' || substring(id::text, 1, 8)
WHERE id = 'e9f97b88-5783-4047-8fad-c03a61f4ac09' AND slug IS NULL;

-- Bootstrap Brewing
UPDATE events SET slug = 'bootstrap-brewing-' || substring(id::text, 1, 8)
WHERE id = 'b24faace-aae7-4cc7-a291-63fbfcb21c92' AND slug IS NULL;

-- Brewery Rickoli (first instance)
UPDATE events SET slug = 'brewery-rickoli-' || substring(id::text, 1, 8)
WHERE id = '699500de-f4f2-4859-bc53-95fbcb56a0c9' AND slug IS NULL;

-- Dirty Dogs Roadhouse
UPDATE events SET slug = 'dirty-dogs-roadhouse-' || substring(id::text, 1, 8)
WHERE id = '8da5cb5f-aaab-4ee0-9ca5-4824f3a244e5' AND slug IS NULL;

-- Green Mountain Beer Company
UPDATE events SET slug = 'green-mountain-beer-' || substring(id::text, 1, 8)
WHERE id = 'a519edb7-0936-4dbe-a12c-bda6239b7bfa' AND slug IS NULL;

-- Dry Dock Brewing
UPDATE events SET slug = 'dry-dock-brewing-' || substring(id::text, 1, 8)
WHERE id = '7a0b8daf-8f4f-4d08-9072-a693809dc2f0' AND slug IS NULL;

-- La Dulce Vida Comedy
UPDATE events SET slug = 'la-dulce-vida-comedy-' || substring(id::text, 1, 8)
WHERE id = '239adc95-6c15-425a-a774-633eefe5c117' AND slug IS NULL;

-- Mercury Cafe Poetry Slam / The Pearl
UPDATE events SET slug = 'mercury-cafe-poetry-slam-' || substring(id::text, 1, 8)
WHERE id = 'b1d56779-f05d-4403-8701-7481d1f23482' AND slug IS NULL;

-- Full House Sports Bar
UPDATE events SET slug = 'full-house-sports-bar-' || substring(id::text, 1, 8)
WHERE id = 'd0eef26a-3595-4318-ba97-b839ee17e1a5' AND slug IS NULL;

-- Hooked on Colfax
UPDATE events SET slug = 'hooked-on-colfax-' || substring(id::text, 1, 8)
WHERE id = 'cfb12b02-3d96-4287-8e99-1c70c712b2ab' AND slug IS NULL;

-- The Attic
UPDATE events SET slug = 'the-attic-' || substring(id::text, 1, 8)
WHERE id = 'fc2a2379-edb9-4b30-9b22-f524cf10dc99' AND slug IS NULL;

-- Blazin Bite Seafood (first instance)
UPDATE events SET slug = 'blazin-bite-seafood-' || substring(id::text, 1, 8)
WHERE id = 'd43011ce-be46-486d-af6d-7a978ea0d16d' AND slug IS NULL;

-- Corner Beet
UPDATE events SET slug = 'corner-beet-' || substring(id::text, 1, 8)
WHERE id = '68a73233-2376-4eb6-abc4-112112a83ba3' AND slug IS NULL;

-- Cannonball Creek
UPDATE events SET slug = 'cannonball-creek-' || substring(id::text, 1, 8)
WHERE id = '1acacdc7-ab31-4d10-8852-702c4a14d867' AND slug IS NULL;

-- Lyons Rock Garden
UPDATE events SET slug = 'lyons-rock-garden-' || substring(id::text, 1, 8)
WHERE id = '9a40527d-4769-4c9f-91ac-d4dbd1d658e5' AND slug IS NULL;

-- Long Table Brewhouse
UPDATE events SET slug = 'long-table-brewhouse-' || substring(id::text, 1, 8)
WHERE id = '30f44c67-5958-4ca7-a1ae-1d230b600e17' AND slug IS NULL;

-- FlyteCo Tower
UPDATE events SET slug = 'flyteco-tower-' || substring(id::text, 1, 8)
WHERE id = '95a7a95e-3ed5-4bc5-bee6-898e9be4e16a' AND slug IS NULL;

-- Halftime Sports Bar
UPDATE events SET slug = 'halftime-sports-bar-' || substring(id::text, 1, 8)
WHERE id = 'be95e65d-7b5d-4faf-ae49-ca36c1939013' AND slug IS NULL;

-- Listening Room (Kiln)
UPDATE events SET slug = 'listening-room-kiln-' || substring(id::text, 1, 8)
WHERE id = '1639c0fc-7564-461a-8ee2-089111dee6f6' AND slug IS NULL;

-- Lion's Lair
UPDATE events SET slug = 'lions-lair-' || substring(id::text, 1, 8)
WHERE id = '20ddfe40-7873-4929-bbe6-c26048cba6b1' AND slug IS NULL;

-- Roots Music Project
UPDATE events SET slug = 'roots-music-project-' || substring(id::text, 1, 8)
WHERE id = '8d8417fd-988f-4396-b2b1-47dd8fe33a71' AND slug IS NULL;

-- Swallow Hill Open Stage
UPDATE events SET slug = 'swallow-hill-open-stage-' || substring(id::text, 1, 8)
WHERE id = 'c41ec739-818a-46ce-8032-8d92ca386aee' AND slug IS NULL;

-- Squire Lounge
UPDATE events SET slug = 'squire-lounge-' || substring(id::text, 1, 8)
WHERE id = '19be18c2-f32a-4a6d-9786-1a58819619c0' AND slug IS NULL;

-- Tavern on 26th
UPDATE events SET slug = 'tavern-on-26th-' || substring(id::text, 1, 8)
WHERE id = '43256bd2-b854-41b3-b048-e4bfacb9bf62' AND slug IS NULL;

-- Da Big Kahuna
UPDATE events SET slug = 'da-big-kahuna-' || substring(id::text, 1, 8)
WHERE id = '1498c1c7-04f9-4193-9872-d15708f6d334' AND slug IS NULL;

-- Mozarts
UPDATE events SET slug = 'mozarts-' || substring(id::text, 1, 8)
WHERE id = '1a9fd502-bb43-4e85-8ac7-943fc2f02665' AND slug IS NULL;

-- Blazin Bite Seafood (second instance)
UPDATE events SET slug = 'blazin-bite-seafood-bbq-' || substring(id::text, 1, 8)
WHERE id = '07cecda1-6e46-434b-8a36-1f35cce955c8' AND slug IS NULL;

-- Oddes
UPDATE events SET slug = 'oddes-' || substring(id::text, 1, 8)
WHERE id = '61a20977-7950-4292-b16a-5f3956bc72cc' AND slug IS NULL;

-- Brewery Rickoli (second instance)
UPDATE events SET slug = 'brewery-rickoli-' || substring(id::text, 1, 8)
WHERE id = '3f82c56b-08d7-4296-9bfc-d8c419a38606' AND slug IS NULL;

-- Cafe Ole
UPDATE events SET slug = 'cafe-ole-' || substring(id::text, 1, 8)
WHERE id = '8d47318f-7624-4b19-85a7-ad4ead677c3f' AND slug IS NULL;

-- Fraco's
UPDATE events SET slug = 'fracos-' || substring(id::text, 1, 8)
WHERE id = '26279db8-3748-4122-9b19-2c760b3b0ead' AND slug IS NULL;

-- Karma House
UPDATE events SET slug = 'karma-house-' || substring(id::text, 1, 8)
WHERE id = '2b931ee3-935e-4dc3-8e2a-ff466afc65eb' AND slug IS NULL;

-- Circular Lounge - Knotted Root
UPDATE events SET slug = 'circular-lounge-knotted-root-' || substring(id::text, 1, 8)
WHERE id = 'f8509892-0c43-44b5-9602-b58025441518' AND slug IS NULL;

-- Morrison Holiday Bar
UPDATE events SET slug = 'morrison-holiday-bar-' || substring(id::text, 1, 8)
WHERE id = 'aadcd495-c08a-41f7-a5f3-a63d04cd6ec0' AND slug IS NULL;

-- Pines B&G
UPDATE events SET slug = 'pines-bar-grill-' || substring(id::text, 1, 8)
WHERE id = '2a0ae0ad-433f-4ffd-a062-28667616214f' AND slug IS NULL;

-- Lincoln's Roadhouse
UPDATE events SET slug = 'lincolns-roadhouse-' || substring(id::text, 1, 8)
WHERE id = 'a08da896-2673-46cd-9aa3-d69bcfc457c5' AND slug IS NULL;

-- Raices
UPDATE events SET slug = 'raices-' || substring(id::text, 1, 8)
WHERE id = '8e969817-8f2a-4b77-a113-e89c5447678b' AND slug IS NULL;

-- Wild Sky Brewery
UPDATE events SET slug = 'wild-sky-brewery-' || substring(id::text, 1, 8)
WHERE id = 'bdf7374a-55d5-4d71-9221-b95073d5c7c2' AND slug IS NULL;

-- Night Owls Bar
UPDATE events SET slug = 'night-owls-bar-' || substring(id::text, 1, 8)
WHERE id = '156ff2bf-c5be-407d-9f84-de5f9130d5d0' AND slug IS NULL;

-- Outback
UPDATE events SET slug = 'outback-saloon-' || substring(id::text, 1, 8)
WHERE id = '9eb841eb-9aa5-4b9a-b08c-9646853c76cc' AND slug IS NULL;

-- Shambles
UPDATE events SET slug = 'shambles-' || substring(id::text, 1, 8)
WHERE id = '6d45df4f-29c6-4e47-ab96-1cf4b7ad640c' AND slug IS NULL;

-- City O' City
UPDATE events SET slug = 'city-o-city-' || substring(id::text, 1, 8)
WHERE id = '9dc3eedd-821a-44e9-a175-27e016f9cb88' AND slug IS NULL;

-- Tandoori
UPDATE events SET slug = 'tandoori-grill-' || substring(id::text, 1, 8)
WHERE id = '56437544-fedd-44c2-a109-7e1e3940b798' AND slug IS NULL;

-- Wild Goose Saloon
UPDATE events SET slug = 'wild-goose-saloon-' || substring(id::text, 1, 8)
WHERE id = 'b1cdae62-ca62-40b7-9780-73c8ff206af4' AND slug IS NULL;

-- Crazy Mountain Brewery
UPDATE events SET slug = 'crazy-mountain-brewery-' || substring(id::text, 1, 8)
WHERE id = '79ffef69-3564-45f9-b9e8-5a8bc436256d' AND slug IS NULL;

-- Modern Brew
UPDATE events SET slug = 'modern-brew-' || substring(id::text, 1, 8)
WHERE id = 'c660adbb-b6f5-4bb6-8cb0-8e0fa191fa84' AND slug IS NULL;

-- Northside
UPDATE events SET slug = 'northside-' || substring(id::text, 1, 8)
WHERE id = '61645ac5-f071-41b9-9727-ac2d099f5a1e' AND slug IS NULL;

-- Two Moons
UPDATE events SET slug = 'two-moons-music-hall-' || substring(id::text, 1, 8)
WHERE id = 'aad664c0-c3b7-4a2c-9e15-95a49e935da4' AND slug IS NULL;

-- Second Dawn (third instance)
UPDATE events SET slug = 'second-dawn-brewing-' || substring(id::text, 1, 8)
WHERE id = '65a74692-75d2-46c4-809c-4c75445018d3' AND slug IS NULL;

-- Rails End (second instance)
UPDATE events SET slug = 'rails-end-beer-' || substring(id::text, 1, 8)
WHERE id = 'ebc2b0a5-314f-4b60-97e7-9c1e707d0f3a' AND slug IS NULL;

-- Cactus Jack's
UPDATE events SET slug = 'cactus-jacks-' || substring(id::text, 1, 8)
WHERE id = '53adde01-d94d-4625-a842-cf2b37c60fc1' AND slug IS NULL;

-- La Dolce Vita
UPDATE events SET slug = 'la-dolce-vita-' || substring(id::text, 1, 8)
WHERE id = '18765081-2cba-4206-a0c6-3600620574aa' AND slug IS NULL;

-- Royal Kumete Kava
UPDATE events SET slug = 'royal-kumete-kava-' || substring(id::text, 1, 8)
WHERE id = '437409e6-d2bb-4b78-90cf-76c7be87e262' AND slug IS NULL;

-- Bodega Beer
UPDATE events SET slug = 'bodega-beer-' || substring(id::text, 1, 8)
WHERE id = '85b9b6a6-7032-422e-b771-bfe52ccdd620' AND slug IS NULL;

-- Denver Art Society
UPDATE events SET slug = 'denver-art-society-' || substring(id::text, 1, 8)
WHERE id = '2651297f-00fb-4b39-81a7-fc86ef492ff4' AND slug IS NULL;

-- Update timestamps
UPDATE events
SET updated_at = NOW()
WHERE slug IS NOT NULL
  AND updated_at < NOW() - INTERVAL '1 minute';

-- Final catch-all: Generate slugs for any remaining events without slugs
UPDATE events
SET slug = lower(
  regexp_replace(
    regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'),
    '\s+', '-', 'g'
  )
) || '-' || substring(id::text, 1, 8)
WHERE slug IS NULL;
