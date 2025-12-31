"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { GripVertical, X, Trash2, Check, Pencil } from "lucide-react";

interface Photo {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

interface AlbumPhotoManagerProps {
  albumId: string;
  albumName: string;
  photos: Photo[];
  onUpdate: () => void;
  onClose: () => void;
}

// Sortable photo card component
function SortablePhotoCard({
  photo,
  isEditingCaption,
  captionValue,
  onStartEditCaption,
  onCaptionChange,
  onSaveCaption,
  onCancelCaption,
  onRemoveFromAlbum,
  onDelete,
}: {
  photo: Photo;
  isEditingCaption: boolean;
  captionValue: string;
  onStartEditCaption: () => void;
  onCaptionChange: (value: string) => void;
  onSaveCaption: () => void;
  onCancelCaption: () => void;
  onRemoveFromAlbum: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)]">
        <Image
          src={photo.image_url}
          alt={photo.caption || "Gallery image"}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 16vw"
          className="object-cover"
        />

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1.5 left-1.5 p-1 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-3.5 h-3.5 text-white" />
        </div>

        {/* Action buttons */}
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onRemoveFromAlbum}
            className="p-1 bg-black/60 rounded hover:bg-yellow-600 transition-colors"
            title="Remove from album"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
          <button
            onClick={onDelete}
            className="p-1 bg-black/60 rounded hover:bg-red-600 transition-colors"
            title="Delete photo"
          >
            <Trash2 className="w-3.5 h-3.5 text-white" />
          </button>
        </div>

        {/* Caption indicator */}
        {photo.caption && !isEditingCaption && (
          <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white text-xs truncate">{photo.caption}</p>
          </div>
        )}
      </div>

      {/* Caption editor */}
      <div className="mt-1.5">
        {isEditingCaption ? (
          <div className="flex gap-1">
            <input
              type="text"
              value={captionValue}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Add caption..."
              className="flex-1 text-xs px-2 py-1.5 rounded border border-[var(--color-border-default)] bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-border-accent)]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") onSaveCaption();
                if (e.key === "Escape") onCancelCaption();
              }}
            />
            <button
              onClick={onSaveCaption}
              className="p-1.5 text-green-500 hover:bg-green-500/10 rounded transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onStartEditCaption}
            className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] truncate w-full text-left group/caption"
          >
            <Pencil className="w-3 h-3 opacity-0 group-hover/caption:opacity-100 transition-opacity flex-shrink-0" />
            <span className="truncate">
              {photo.caption || "Add caption..."}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

export function AlbumPhotoManager({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  albumId: _albumId,
  albumName,
  photos: initialPhotos,
  onUpdate,
  onClose,
}: AlbumPhotoManagerProps) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionValue, setCaptionValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reorder photos
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = photos.findIndex((p) => p.id === active.id);
      const newIndex = photos.findIndex((p) => p.id === over.id);
      const newOrder = arrayMove(photos, oldIndex, newIndex);
      setPhotos(newOrder);

      // Update sort_order in database
      setIsSaving(true);
      const supabase = createClient();

      const updates = newOrder.map((photo, index) => ({
        id: photo.id,
        sort_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("gallery_images")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
      }

      setIsSaving(false);
      toast.success("Photo order updated");
    },
    [photos]
  );

  // Remove from album (doesn't delete photo)
  const removeFromAlbum = useCallback(
    async (photoId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("gallery_images")
        .update({ album_id: null })
        .eq("id", photoId);

      if (error) {
        toast.error("Failed to remove photo from album");
      } else {
        setPhotos(photos.filter((p) => p.id !== photoId));
        toast.success("Photo removed from album");
        onUpdate();
      }
    },
    [photos, onUpdate]
  );

  // Delete photo entirely
  const deletePhoto = useCallback(
    async (photoId: string) => {
      if (!confirm("Delete this photo permanently?")) return;

      const supabase = createClient();
      const { error } = await supabase
        .from("gallery_images")
        .delete()
        .eq("id", photoId);

      if (error) {
        toast.error("Failed to delete photo");
      } else {
        setPhotos(photos.filter((p) => p.id !== photoId));
        toast.success("Photo deleted");
        onUpdate();
      }
    },
    [photos, onUpdate]
  );

  // Save caption
  const saveCaption = useCallback(
    async (photoId: string) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("gallery_images")
        .update({ caption: captionValue || null })
        .eq("id", photoId);

      if (error) {
        toast.error("Failed to save caption");
      } else {
        setPhotos(
          photos.map((p) =>
            p.id === photoId ? { ...p, caption: captionValue || null } : p
          )
        );
        toast.success("Caption saved");
      }
      setEditingCaption(null);
    },
    [captionValue, photos]
  );

  return (
    <div className="mt-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border-default)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
            Photos in &quot;{albumName}&quot;
          </h4>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {photos.length} {photos.length === 1 ? "photo" : "photos"} &bull;
            Drag to reorder
            {isSaving && (
              <span className="ml-2 text-[var(--color-text-accent)]">
                Saving...
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-3 py-1.5 rounded-lg border border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] transition-colors"
        >
          Close
        </button>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-8 text-[var(--color-text-secondary)]">
          <p>No photos in this album yet.</p>
          <p className="text-xs mt-1">
            Upload photos and select this album as the destination.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={photos.map((p) => p.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {photos.map((photo) => (
                <SortablePhotoCard
                  key={photo.id}
                  photo={photo}
                  isEditingCaption={editingCaption === photo.id}
                  captionValue={captionValue}
                  onStartEditCaption={() => {
                    setEditingCaption(photo.id);
                    setCaptionValue(photo.caption || "");
                  }}
                  onCaptionChange={setCaptionValue}
                  onSaveCaption={() => saveCaption(photo.id)}
                  onCancelCaption={() => setEditingCaption(null)}
                  onRemoveFromAlbum={() => removeFromAlbum(photo.id)}
                  onDelete={() => deletePhoto(photo.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
