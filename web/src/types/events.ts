// CSC Event System Types

export type EventType =
  | "song_circle"
  | "workshop"
  | "meetup"
  | "showcase"
  | "open_mic"
  | "gig"
  | "kindred_group"
  | "jam_session"
  | "poetry"
  | "irish"
  | "blues"
  | "bluegrass"
  | "comedy"
  | "other";

export type RSVPStatus = "confirmed" | "waitlist" | "cancelled";

export type HostRole = "host" | "cohost";

export type InvitationStatus = "pending" | "accepted" | "declined";

export type EventVisibility = "public" | "invite_only";

export type AttendeeInviteStatus = "pending" | "accepted" | "declined" | "revoked" | "expired";

export interface CSCEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType[];
  is_dsc_event: boolean;
  capacity: number | null;
  host_notes: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  day_of_week: string | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  specific_dates: string[] | null;
  status: string;
  visibility: EventVisibility;
  created_at: string;
  updated_at: string;
  // Joined data
  hosts?: EventHostWithProfile[];
  rsvp_count?: number;
  user_rsvp?: RSVP | null;
}

export interface RSVP {
  id: string;
  event_id: string;
  user_id: string;
  status: RSVPStatus;
  waitlist_position: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventHost {
  id: string;
  event_id: string;
  user_id: string;
  role: HostRole;
  invitation_status: InvitationStatus;
  invited_by: string | null;
  invited_at: string;
  responded_at: string | null;
  created_at: string;
}

export interface EventHostWithProfile extends EventHost {
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventComment {
  id: string;
  event_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  is_host_only: boolean;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventAttendeeInvite {
  id: string;
  event_id: string;
  user_id: string | null;
  email: string | null;
  token_hash: string | null;
  status: AttendeeInviteStatus;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  // Joined data
  inviter?: {
    id: string;
    full_name: string | null;
  };
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface HostRequest {
  id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ApprovedHost {
  id: string;
  user_id: string;
  approved_by: string | null;
  approved_at: string;
  status: "active" | "suspended" | "revoked";
  notes: string | null;
  created_at: string;
}

// Form types
export interface CreateEventForm {
  title: string;
  description: string;
  event_type: EventType[];
  capacity: number | null;
  venue_name: string;
  address: string;
  city: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  frequency: "weekly" | "biweekly" | "monthly" | "one_time";
  specific_dates: string[];
  host_notes: string;
}

// Event type metadata for UI
export const EVENT_TYPE_CONFIG: Record<EventType, {
  label: string;
  description: string;
  icon: string;
  defaultCapacity: number | null;
}> = {
  song_circle: {
    label: "Song Circle",
    description: "Intimate gathering for sharing original songs and feedback",
    icon: "🎶",
    defaultCapacity: 12
  },
  workshop: {
    label: "Workshop",
    description: "Educational session on songwriting techniques",
    icon: "📚",
    defaultCapacity: 20
  },
  meetup: {
    label: "Meetup",
    description: "Casual networking and community gathering",
    icon: "🤝",
    defaultCapacity: null
  },
  showcase: {
    label: "Showcase",
    description: "Curated performance event with selected artists",
    icon: "🎭",
    defaultCapacity: null
  },
  open_mic: {
    label: "Open Mic",
    description: "Open performance slots for all skill levels",
    icon: "🎤",
    defaultCapacity: null
  },
  gig: {
    label: "Gig / Performance",
    description: "A scheduled performance or concert by an artist or band",
    icon: "🎵",
    defaultCapacity: null
  },
  kindred_group: {
    label: "Kindred Songwriter Groups",
    description: "Happenings hosted by other local songwriter communities",
    icon: "🤝",
    defaultCapacity: null
  },
  jam_session: {
    label: "Jam Session",
    description: "Casual music gathering for jamming and improvisation",
    icon: "🎸",
    defaultCapacity: null
  },
  poetry: {
    label: "Poetry",
    description: "Spoken word and poetry performance or open mic",
    icon: "✒️",
    defaultCapacity: null
  },
  irish: {
    label: "Irish",
    description: "Traditional Irish music session or gathering",
    icon: "☘️",
    defaultCapacity: null
  },
  blues: {
    label: "Blues",
    description: "Blues music jam, open mic, or performance",
    icon: "🎸",
    defaultCapacity: null
  },
  bluegrass: {
    label: "Bluegrass",
    description: "Bluegrass music jam, picking circle, or performance",
    icon: "🪕",
    defaultCapacity: null
  },
  comedy: {
    label: "Comedy",
    description: "Stand-up comedy open mic or showcase",
    icon: "😂",
    defaultCapacity: null
  },
  other: {
    label: "Other Event",
    description: "Custom event type",
    icon: "📅",
    defaultCapacity: null
  }
};

// Genre-specific types take emoji/icon priority over jam_session
const GENRE_PRIORITY_TYPES: EventType[] = ["blues", "bluegrass", "irish", "poetry", "comedy"];

/**
 * Select the "primary" event type from an array for display purposes.
 * Genre-specific types (blues, bluegrass, irish, poetry, comedy) take priority
 * over generic types like jam_session — e.g., a blues jam shows the blues icon.
 */
export function getPrimaryEventType(types: EventType[]): EventType {
  return types.find(t => GENRE_PRIORITY_TYPES.includes(t)) ?? types[0] ?? "other";
}

export const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 Weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "one_time", label: "One-Time Event" }
];
