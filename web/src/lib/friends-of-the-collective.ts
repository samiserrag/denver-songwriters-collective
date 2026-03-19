export interface CollectiveFriend {
  id: string;
  slug?: string;
  name: string;
  websiteUrl: string;
  city?: string;
  organizationType?: string;
  shortBlurb: string;
  whyItMatters: string;
  tags?: string[];
  featured?: boolean;
  isActive?: boolean;
  logoImageUrl?: string;
  coverImageUrl?: string;
  funNote?: string;
  sortOrder?: number;
  memberTags?: CollectiveFriendMemberTag[];
  contentLinks?: CollectiveFriendContentLink[];
  relatedBlogPosts?: CollectiveFriendBlogLink[];
  relatedGalleryAlbums?: CollectiveFriendGalleryLink[];
  relatedEventSeries?: CollectiveFriendSeriesLink[];
}

export interface CollectiveFriendMemberTag {
  profileId: string;
  name: string;
  avatarUrl?: string;
  profileUrl: string;
  sortOrder: number;
  tagReason?: string;
}

export interface CollectiveFriendContentLink {
  id: string;
  linkType: "blog_post" | "gallery_album" | "event_series";
  targetId: string;
  sortOrder: number;
  labelOverride?: string;
}

export interface CollectiveFriendBlogLink {
  id: string;
  title: string;
  href: string;
}

export interface CollectiveFriendGalleryLink {
  id: string;
  name: string;
  href: string;
}

export interface CollectiveFriendSeriesLink {
  seriesId: string;
  title: string;
  href: string;
  nextDate?: string;
}

/**
 * Friends of the Collective directory.
 *
 * Keep descriptions factual, respectful, and concise.
 */

export const FRIENDS_OF_COLLECTIVE_EXCLUDED: Array<{
  websiteUrl: string;
  reason: string;
}> = [];

export const FRIENDS_OF_COLLECTIVE: CollectiveFriend[] = [
  {
    id: "rock-for-the-people",
    name: "Rock For The People",
    websiteUrl: "https://www.rockforthepeople.org",
    city: "Lafayette, CO",
    organizationType: "Nonprofit",
    shortBlurb:
      "Rock For The People is a Lafayette, Colorado nonprofit that creates performance, recording, rehearsal, marketing, and career development opportunities for musicians from historically underrepresented groups.",
    whyItMatters:
      "Songwriters gain access to free recording and rehearsal scholarships, paid performance slots, marketing support, and a recurring monthly Songwriter Meetup - directly reducing barriers to craft and visibility.",
    tags: ["Open Mic", "Songwriter Meetup", "Scholarships", "Equity in Music", "Community Events"],
    featured: false,
    isActive: true,
  },
  {
    id: "stone-cottage-studios",
    name: "Stone Cottage Studios",
    websiteUrl: "https://www.stonecottagestudios.com",
    city: "Boulder, CO",
    organizationType: "Recording Studio & Media",
    shortBlurb:
      "Stone Cottage Studios is a Boulder-based music production and discovery space offering live and livestream concerts, interview-based Artist Sessions, and pro audio and video recording for local and visiting musicians.",
    whyItMatters:
      "Songwriters can share their stories and music through distributed Artist Sessions, gaining fan visibility and media presence across multiple platforms.",
    tags: ["Recording", "Live Sessions", "Artist Promotion", "Livestream", "Boulder"],
    featured: false,
    isActive: true,
  },
  {
    id: "to-the-fives-taproom",
    name: "To The Fives Taproom & Lounge",
    websiteUrl: "https://tothefivestaproom.square.site",
    organizationType: "Venue",
    shortBlurb:
      "To The Fives Taproom & Lounge is an intimate listening room venue that hosts live local music nearly every weekend alongside weekly genre-specific open stage jams including Acoustic Song, Blues, Funk, and Reggae.",
    whyItMatters:
      "Recurring open stage jams and local shows create consistent, low-barrier opportunities to perform original work for live audiences.",
    tags: ["Open Mic", "Live Music Venue", "Open Stage Jams", "Local Artists", "Listening Room"],
    featured: false,
    isActive: true,
  },
  {
    id: "colorado-bluegrass-music-society",
    name: "Colorado Bluegrass Music Society (CBMS)",
    websiteUrl: "https://www.coloradobluegrass.org",
    city: "Denver, CO",
    organizationType: "Music Society",
    shortBlurb:
      "The Colorado Bluegrass Music Society maintains a statewide directory of bluegrass jams held across Colorado, from Denver and Boulder to Durango and Breckenridge, spanning all skill levels.",
    whyItMatters:
      "Acoustic songwriter-instrumentalists can find ongoing jam communities throughout the state to develop their craft, connect with other players, and workshop new material.",
    tags: ["Bluegrass", "Jams", "Acoustic", "Statewide", "Community Music"],
    featured: false,
    isActive: true,
  },
  {
    id: "couched-media",
    name: "Couched Media",
    websiteUrl: "https://www.pinksofahour.com",
    organizationType: "Nonprofit & Media Production",
    shortBlurb:
      "Couched Media is the in-house multimedia production arm connected to Pink Sofa Hour and the Pink Sofa Production Syndicate (PSPS), supporting local musicians with recording, storytelling, and promotion.",
    whyItMatters:
      "Songwriters receive free booking assistance, promotional resources, audio recording access, and educational content - with all commercial revenue from the production side reinvested into artist support.",
    tags: ["Booking", "Promotion", "Nonprofit", "Recording", "Livestream"],
    featured: false,
    isActive: true,
  },
  {
    id: "front-range-songwriters",
    name: "Front Range Songwriters",
    websiteUrl: "https://www.frontrangesongwriters.com",
    city: "Colorado Springs, CO",
    organizationType: "Songwriting Collective",
    shortBlurb:
      "Front Range Songwriters is a Colorado Springs-based organization for songwriters and lyricists that meets monthly to explore the creation of music.",
    whyItMatters:
      "A dedicated local gathering place for songwriters and lyricists to meet, workshop ideas, and build community - one of the few organizations in the region focused specifically on the craft of songwriting.",
    tags: ["Songwriting", "Lyricists", "Monthly Meetup", "Colorado Springs", "Craft Development"],
    featured: false,
    isActive: true,
  },
  {
    id: "concretecouch",
    name: "Concrete Couch",
    websiteUrl: "https://www.concretecouch.org",
    city: "Colorado Springs, CO",
    organizationType: "Nonprofit",
    shortBlurb:
      "Concrete Couch is a Colorado Springs-based 501(c)3 nonprofit serving the Pikes Peak region since 2003 that builds community through creative projects including public art, performance, classes, and shared skill-building.",
    whyItMatters:
      "Songwriters and performing artists can connect with a broad community creative infrastructure that includes performance opportunities, collaborative events, and a space where music sits alongside other community arts.",
    tags: ["Community Arts", "Performance", "Colorado Springs", "Nonprofit", "Creative Community"],
    featured: false,
    isActive: true,
  },
  {
    id: "black-rose-acoustic-society",
    name: "The Black Rose Acoustic Society",
    websiteUrl: "https://www.blackroseacoustic.org",
    city: "Colorado Springs, CO",
    organizationType: "Music Society",
    shortBlurb:
      "The Black Rose Acoustic Society has been bringing handmade acoustic music to the Pikes Peak region since 1994, offering intimate concerts, jams, open mics, showcases, classes, scholarships, and a dedicated songwriting circle.",
    whyItMatters:
      "Songwriters in the Colorado Springs area have a rare, long-established home base with recurring songwriting classes, open mics, showcases, and performance opportunities all under one community roof.",
    tags: ["Acoustic", "Songwriting Circle", "Open Mic", "Showcase", "Colorado Springs"],
    featured: false,
    isActive: true,
  },
  {
    id: "westernwish-productions",
    name: "WesternWish Productions",
    websiteUrl: "https://www.westernwish.com",
    city: "Denver, CO",
    organizationType: "Event Production",
    shortBlurb:
      "WesternWish Productions is a Denver-based event production organization that curates intimate showcase series and listening experiences exclusively for independent, original-music artists on the Front Range.",
    whyItMatters:
      "By focusing exclusively on original work and crafting intentional listening environments, WesternWish gives songwriters a dedicated stage and audience that centers the music itself.",
    tags: ["Original Music", "Showcases", "Listening Room", "Independent Artists", "Denver"],
    featured: false,
    isActive: true,
  },
  {
    id: "denverse-magazine",
    name: "Denverse Magazine",
    websiteUrl: "https://www.denversemagazine.com",
    city: "Denver, CO",
    organizationType: "Independent Media",
    shortBlurb:
      "Denverse is a quarterly, all-human, AI-free independent print magazine dedicated to Denver arts and culture, featuring local writers, musicians, comedians, and artists, with subscriber events including concerts, readings, and creative workshops.",
    whyItMatters:
      "Songwriters and musicians can gain coverage in a respected local print publication and access subscriber events - concerts, creative workshops, and issue launch parties - that foster direct community connection.",
    tags: ["Local Media", "Arts Coverage", "Denver", "Print Magazine", "Community Events"],
    featured: false,
    isActive: true,
  },
  {
    id: "swallow-hill-music",
    name: "Swallow Hill Music",
    websiteUrl: "https://swallowhillmusic.org/about-us/",
    city: "Denver, CO",
    organizationType: "Nonprofit Music School & Venue",
    shortBlurb:
      "Swallow Hill Music is a Denver nonprofit music school and concert community focused on folk, roots, and acoustic music education and performance.",
    whyItMatters:
      "Songwriters can access classes, workshops, and listening-room style performances that support craft growth, community connection, and live opportunities.",
    tags: ["Songwriting Classes", "Folk", "Acoustic", "Concerts", "Music Education"],
    featured: false,
    isActive: true,
  },
];

export function getFriendsOfCollective(): CollectiveFriend[] {
  return [...FRIENDS_OF_COLLECTIVE]
    .filter((friend) => friend.isActive !== false)
    .sort((a, b) => {
      if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}
