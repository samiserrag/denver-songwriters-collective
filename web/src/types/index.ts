export type EventType = "showcase" | "open_mic" | "song_circle" | "critique_circle";

export interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  eventType?: EventType;
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
  location?: string;
  avatarUrl?: string;
  isSpotlight?: boolean;
  socialLinks?: SocialLinks;
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
