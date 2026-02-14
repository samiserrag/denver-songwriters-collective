"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { reconcileAlbumLinks } from "@/lib/gallery/albumLinks";
import CollaboratorSelect, { type Collaborator } from "@/components/gallery/CollaboratorSelect";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface Venue {
  id: string;
  name: string;
}

interface Event {
  id: string;
  title: string;
  event_date: string | null;
}

interface CreateAlbumFormProps {
  venues: Venue[];
  events: Event[];
  userId: string;
}

export function CreateAlbumForm({ venues, events, userId }: CreateAlbumFormProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [saveAsDraft, setSaveAsDraft] = useState(false);
  const [venueId, setVenueId] = useState("");
  const [eventId, setEventId] = useState("");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleCreate = async () => {
    const trimmedName = albumName.trim();
    if (!trimmedName) {
      setError("Album name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    const supabase = createClient();
    const baseSlug = generateSlug(trimmedName);

    // Check for existing slugs and auto-increment if needed
    let finalSlug = baseSlug;
    const { data: existingSlugs } = await supabase
      .from("gallery_albums")
      .select("slug")
      .like("slug", `${baseSlug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(existingSlugs.map((a: { slug: string }) => a.slug));
      let counter = 1;
      while (slugSet.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }
    }

    const isPublished = !saveAsDraft;
    const venueIdValue = venueId || null;
    const eventIdValue = eventId || null;

    const { data, error: insertError } = await supabase
      .from("gallery_albums")
      .insert({
        name: trimmedName,
        slug: finalSlug,
        created_by: userId,
        is_published: isPublished,
        venue_id: venueIdValue,
        event_id: eventIdValue,
      })
      .select("id, name")
      .single();

    if (insertError) {
      console.error("Album creation error:", insertError);
      setError("Could not create album. Please try again.");
      setIsCreating(false);
      return;
    }

    // Reconcile album links (creator + venue + event + collaborators)
    try {
      await reconcileAlbumLinks(supabase, data.id, {
        createdBy: userId,
        venueId: venueIdValue,
        eventId: eventIdValue,
        collaboratorIds: collaborators.map((c) => c.id),
      });
    } catch (linkError) {
      console.error("Album link reconciliation error:", linkError);
      toast.error("Album created but cross-page links failed. Edit the album to retry.");
    }

    toast.success(isPublished ? "Album created and published" : "Album created as draft");

    // Reset form
    setAlbumName("");
    setSaveAsDraft(false);
    setVenueId("");
    setEventId("");
    setCollaborators([]);
    setShowForm(false);
    setIsCreating(false);

    // Navigate to the new album's edit page to upload photos
    router.push(`/dashboard/gallery/albums/${data.id}`);
    router.refresh();
  };

  if (!showForm) {
    return (
      <button
        type="button"
        onClick={() => setShowForm(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-[var(--color-bg-secondary)] border-2 border-dashed border-[var(--color-border-default)] rounded-lg text-[var(--color-text-accent)] hover:border-[var(--color-border-accent)] hover:bg-[var(--color-bg-tertiary)] transition-all"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Create New Album</span>
      </button>
    );
  }

  return (
    <div className="p-6 bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-lg">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
        Create New Album
      </h2>

      <div className="space-y-4">
        {/* Album Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">
            Album Name
          </label>
          <input
            type="text"
            value={albumName}
            onChange={(e) => {
              setAlbumName(e.target.value);
              setError(null);
            }}
            placeholder="e.g., Open Mic Night at Mercury Cafe"
            className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]"
            disabled={isCreating}
          />
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>

        {/* Draft toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={saveAsDraft}
            onChange={(e) => setSaveAsDraft(e.target.checked)}
            disabled={isCreating}
            className="w-4 h-4 rounded border-[var(--color-border-default)] text-[var(--color-accent-primary)] focus:ring-[var(--color-accent-primary)]"
          />
          <span className="text-sm text-[var(--color-text-secondary)]">
            Save as draft
            <span className="text-[var(--color-text-tertiary)]"> (won&apos;t appear in public gallery)</span>
          </span>
        </label>

        {/* Venue & Event selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Venue <span className="font-normal text-[var(--color-text-tertiary)]">
                (optional — album appears on venue page)
              </span>
            </label>
            <select
              value={venueId}
              onChange={(e) => setVenueId(e.target.value)}
              disabled={isCreating}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
            >
              <option value="">No venue</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
              Event <span className="font-normal text-[var(--color-text-tertiary)]">
                (optional — album appears on event page)
              </span>
            </label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              disabled={isCreating}
              className="w-full px-3 py-2 bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)]"
            >
              <option value="">No event</option>
              {events.map((ev) => {
                const dateLabel = ev.event_date
                  ? ` — ${new Date(ev.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "America/Denver",
                    })}`
                  : "";
                return (
                  <option key={ev.id} value={ev.id}>
                    {ev.title}{dateLabel}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Collaborators */}
        <div>
          <label className="block text-sm text-[var(--color-text-secondary)] mb-1">
            Collaborators <span className="font-normal text-[var(--color-text-tertiary)]">
              (optional — album appears on their profiles)
            </span>
          </label>
          <CollaboratorSelect
            value={collaborators}
            onChange={setCollaborators}
            ownerId={userId}
            disabled={isCreating}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleCreate}
            disabled={isCreating || !albumName.trim()}
            className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] font-medium rounded-lg disabled:opacity-50 transition-colors"
          >
            {isCreating ? "Creating..." : "Create Album"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setAlbumName("");
              setSaveAsDraft(false);
              setVenueId("");
              setEventId("");
              setCollaborators([]);
              setError(null);
            }}
            disabled={isCreating}
            className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
