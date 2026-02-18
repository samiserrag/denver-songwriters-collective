export type EventType = "showcase" | "open_mic" | "song_circle" | "critique_circle";

// Re-export EventUpdateSuggestion type
export type { EventUpdateSuggestion } from "./eventUpdateSuggestion";

export interface Venue {
  id: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  neighborhood?: string | null;
  map_link?: string | null;
  google_maps_url?: string | null;
  website?: string | null;
  website_url?: string | null;
  phone?: string | null;
  contact_link?: string | null;
  accessibility_notes?: string | null;
  parking_notes?: string | null;
  // Note: 'notes' field is admin-only and NOT exposed on public pages
}

export interface Event {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  host_id?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  event_date?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  // Support both snake_case and camelCase event type fields depending on source
  event_type?: "open_mic" | "showcase" | "song_circle" | "workshop" | "other" | string;
  eventType?: "open_mic" | "showcase" | "song_circle" | "workshop" | "other" | string;
  // Normalized UI fields
  date?: string | null;
  time?: string | null;
  imageUrl?: string | null;
  venue?: string | Venue | null; // can be a legacy string or joined Venue object
  location?: string;
  recurrence_rule?: string | null;
  status?: string | null;
  notes?: string | null;
  region_id?: number | null;
  is_showcase?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  signup_time?: string | null;
  category?: string | null;
  capacity?: number | null;
  rsvp_count?: number | null;
  is_dsc_event?: boolean | null;
  // Verification fields (Phase 4.37)
  last_verified_at?: string | null;
  verified_by?: string | null;
  source?: string | null;
  // Visibility (private events)
  visibility?: "public" | "invite_only";
}

export interface EventWithVenue extends Event {
  venue?: Venue | null;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  website?: string;
}

export interface Songwriter {
  id: string;
  slug?: string | null;
  name: string;
  bio?: string;
  genre?: string;
  genres?: string[];
  instruments?: string[];
  location?: string;
  avatarUrl?: string;
  isSpotlight?: boolean;
  socialLinks?: SocialLinks;
  availableForHire?: boolean;
  interestedInCowriting?: boolean;
  songLinks?: string[];
}

/** @deprecated Use Songwriter instead */
export type Performer = Songwriter;

export type SlotStatus = "open" | "claimed" | "full";

export interface Slot {
  id: string;
  slotNumber?: number;
  startTime: string;
  endTime?: string;
  duration?: string;
  status: SlotStatus;
  performerId?: string;
  performerName?: string;
}

export interface HostSlot extends Slot {
  songwriter?: Songwriter;
  /** @deprecated Use songwriter instead */
  performer?: Songwriter;
}

export interface Host {
  id: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  isSpotlight?: boolean;
  socialLinks?: SocialLinks;
}

export interface Studio {
  id: string;
  slug?: string | null;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface StudioService {
  id: string;
  name: string;
  duration: string;
  price: number;
  description?: string;
}

export type BookingType = "open_mic" | "song_circle" | "recording";

export interface Booking {
  id: string;
  eventType: BookingType;
  eventTitle: string;
  venue: string;
  date: string;
  time: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export type AppointmentStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface SongwriterAppointment {
  id: string;
  service_name: string;
  studio_name: string;
  appointment_time: string;
  status: AppointmentStatus;
}

/** @deprecated Use SongwriterAppointment instead */
export type PerformerAppointment = SongwriterAppointment;

export interface StudioOwnedAppointment {
  id: string;
  status: AppointmentStatus;
  appointment_time: string;
  service_name: string;
  songwriter_name: string | null;
  /** @deprecated Use songwriter_name instead */
  performer_name?: string | null;
}

// Note: "member" is the normalized role for all non-admin users.
// Legacy values (performer, host, studio, fan) are kept for backward compatibility.
export type MemberRole = "member" | "songwriter" | "performer" | "host" | "studio" | "fan";

export interface Member {
  id: string;
  slug?: string | null;
  name: string;
  role: MemberRole;
  // Identity flags (preferred over role for UX)
  isSongwriter?: boolean;
  isHost?: boolean;
  isStudio?: boolean;
  isFan?: boolean;
  isVenueManager?: boolean;
  bio?: string;
  genres?: string[];
  instruments?: string[];
  specialties?: string[];
  location?: string;
  avatarUrl?: string;
  isSpotlight?: boolean;
  socialLinks?: SocialLinks;
  availableForHire?: boolean;
  interestedInCowriting?: boolean;
  openToCollabs?: boolean;
  songLinks?: string[];
}
