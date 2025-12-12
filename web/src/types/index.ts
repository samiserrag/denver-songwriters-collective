export type EventType = "showcase" | "open_mic" | "song_circle" | "critique_circle";

// Re-export EventUpdateSuggestion type
export type { EventUpdateSuggestion } from "./eventUpdateSuggestion";

export interface Venue {
  id: string;
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  map_link?: string | null;
  google_maps_url?: string | null;
  website?: string | null;
  website_url?: string | null;
  phone?: string | null;
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
}

export interface EventWithVenue extends Event {
  venue?: Venue | null;
}

export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  website?: string;
}

export interface Performer {
  id: string;
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
  performer?: Performer;
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

export interface PerformerAppointment {
  id: string;
  service_name: string;
  studio_name: string;
  appointment_time: string;
  status: AppointmentStatus;
}

export interface StudioOwnedAppointment {
  id: string;
  status: AppointmentStatus;
  appointment_time: string;
  service_name: string;
  performer_name: string | null;
}

export type MemberRole = "performer" | "host" | "studio" | "fan";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  isHost?: boolean;
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
