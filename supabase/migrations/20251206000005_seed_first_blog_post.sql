-- Seed the first blog post: Open Mic Etiquette and Tips
-- This will be authored by the admin user (Sami Serrag)
-- Note: Only inserts if an admin profile exists (skips in CI environments)

DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Find the admin user
  SELECT id INTO admin_user_id FROM profiles WHERE role = 'admin' LIMIT 1;

  -- Only insert if admin exists
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO blog_posts (
  author_id,
  slug,
  title,
  excerpt,
  content,
  cover_image_url,
  is_published,
  published_at,
  tags
) VALUES (
      admin_user_id,
  'open-mic-etiquette-and-tips',
  'Open Mic Etiquette and Tips: A Guide for Denver Songwriters',
  'Whether you''re stepping up to the mic for the first time or you''re a seasoned performer, these guidelines will help you make the most of your open mic experience while being a supportive community member.',
  '## Welcome to the Stage

Open mics are magical spaces where songwriters of all levels come together to share their art, support each other, and grow as musicians. Whether you''re stepping up to the mic for the first time or you''re a seasoned performer, these guidelines will help you make the most of your experience.

## Before You Arrive

### Know the Format
Every open mic is different. Some have sign-up sheets, others use a lottery system. Some allow two songs, others give you 10-15 minutes. Check the venue''s social media or call ahead to understand the format before you arrive.

### Prepare Your Set
- Have your songs practiced and ready
- Know your lyrics well enough that you won''t freeze
- Have backup songs in case time allows
- Tune your instrument before you leave home

### Bring What You Need
- Your instrument (if applicable)
- A capo, picks, or any accessories
- A small flashlight or phone for dark stages
- Business cards or a way to share your contact info

## At the Venue

### Arrive Early
- Sign up as soon as the list opens
- Get a feel for the room and the crowd
- Support performers who go before you

### Be a Good Audience Member
This is perhaps the most important part of open mic etiquette:

- **Listen actively** – Put your phone away and give performers your attention
- **Applaud generously** – Everyone deserves encouragement
- **Keep conversations quiet** – Save the chatting for between performers
- **Stay for others** – Don''t just play and leave; the community is built on mutual support

### Respect the Space
- Order food or drinks to support the venue
- Don''t block walkways or the stage area
- Clean up after yourself
- Thank the host and staff

## On Stage

### Setup Quickly
- Have your gear ready before your name is called
- Know how to adjust the mic stand
- Don''t spend your set time tuning

### Engage with the Audience
- Introduce yourself briefly
- Share a sentence about your song if it helps set the mood
- Make eye contact and connect
- Thank the audience and host when you''re done

### Handle Mistakes Gracefully
Everyone makes mistakes. If you mess up:
- Keep going if you can
- Laugh it off – the audience is on your side
- Don''t apologize repeatedly; just continue
- Remember: imperfection is part of live music

### Watch Your Time
- Stick to your allotted time
- If you''re told two songs, play two songs
- Don''t launch into a third song without checking with the host
- Leave time for the next performer

## Supporting Other Artists

### The Golden Rule
Treat every performer the way you''d want to be treated when you''re on stage. This means:

- Giving them your full attention
- Cheering them on, especially if they''re nervous
- Offering genuine compliments afterward
- Connecting on social media and following their journey

### Building Community
Open mics aren''t competitions – they''re communities. Some ways to build connections:

- Exchange contact info with artists you admire
- Offer to collaborate or co-write
- Share other artists'' music on your social media
- Attend regularly and become a familiar face

## For First-Timers

### It''s Okay to Be Nervous
Every single person in that room has felt nervous before performing. The shakiness, the racing heart, the dry mouth – it''s all normal. Take a deep breath. You''ve got this.

### Start Simple
- Choose a song you know inside and out
- Keep your intro short and sweet
- Focus on connecting with one friendly face in the audience
- Remember: the audience wants you to succeed

### Celebrate Yourself
Getting up on stage takes courage. No matter how your performance goes, you did something brave. Be proud of yourself.

## Final Thoughts

Open mics are about more than just performing – they''re about belonging to something bigger than yourself. When you support other artists, show up consistently, and bring positive energy to the room, you become part of a community that will support you in return.

The Denver songwriting community is filled with generous, talented, supportive people. We can''t wait to hear your songs.

> "The music is important — but the people are everything."

See you at the next open mic!

---

*Have questions about open mics in Denver? Check out our [Open Mic Directory](/open-mics) or [contact us](/contact).*',
  NULL,
  true,
  NOW(),
  ARRAY['tips', 'etiquette', 'beginners', 'open mic', 'community']
)
    ON CONFLICT (slug) DO NOTHING;
  END IF;
END
$$;
