"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
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
import { CropModal } from "./CropModal";
import { GripVertical, Crop, X } from "lucide-react";

// Icons
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className || ''}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

export interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  uploadedUrl?: string;
  dbRecordId?: string;
  error?: string;
}

interface BulkUploadGridProps {
  userId: string;
  albums: { id: string; name: string }[];
  venues: { id: string; name: string }[];
  events: { id: string; title: string }[];
  onUploadComplete: () => void;
}

// Sortable Thumbnail Component
function SortableThumbnail({
  file,
  onCrop,
  onRemove,
  onRetry,
}: {
  file: QueuedFile;
  onCrop: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const isPending = file.status === 'pending';
  const isUploading = file.status === 'uploading';
  const isUploaded = file.status === 'uploaded';
  const isError = file.status === 'error';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative aspect-square rounded-lg overflow-hidden border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] group"
    >
      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={file.previewUrl}
        alt=""
        className="w-full h-full object-cover"
      />

      {/* Drag Handle - only for pending files */}
      {isPending && (
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1.5 bg-black/60 rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Status overlay - uploading */}
      {isUploading && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Spinner className="w-8 h-8 text-white" />
        </div>
      )}

      {/* Status overlay - uploaded */}
      {isUploaded && (
        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1 shadow-lg">
          <CheckIcon className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Status overlay - error */}
      {isError && (
        <div className="absolute inset-0 bg-red-500/60 flex flex-col items-center justify-center p-2">
          <p className="text-white text-xs text-center mb-2 line-clamp-2">
            {file.error || 'Upload failed'}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRetry();
            }}
            className="flex items-center gap-1 px-2 py-1 bg-white text-red-600 text-xs font-medium rounded hover:bg-gray-100"
          >
            <RefreshIcon className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* File name tooltip */}
      <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">
          {file.file.name}
        </p>
      </div>

      {/* Action buttons - visible on hover for pending files */}
      {isPending && (
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCrop();
            }}
            className="p-1.5 bg-black/60 rounded hover:bg-black/80 transition-colors"
            title="Crop image"
          >
            <Crop className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="p-1.5 bg-black/60 rounded hover:bg-red-600 transition-colors"
            title="Remove"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function BulkUploadGrid({
  userId,
  albums,
  venues,
  events,
  onUploadComplete,
}: BulkUploadGridProps) {
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [cropTarget, setCropTarget] = useState<QueuedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Metadata state
  const [selectedAlbum, setSelectedAlbum] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");

  // Drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      queuedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
  }, [queuedFiles]);

  // Handle file selection
  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);

    // Filter for images only
    const imageFiles = fileArray.filter((f) =>
      ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type)
    );

    if (imageFiles.length !== fileArray.length) {
      toast.error('Some files were skipped (only images allowed)');
    }

    const newFiles: QueuedFile[] = imageFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending' as const,
      progress: 0,
    }));

    setQueuedFiles((prev) => [...prev, ...newFiles]);
  }, []);

  // Update file status helper
  const updateFileStatus = useCallback(
    (
      id: string,
      status: QueuedFile['status'],
      progress: number,
      error?: string,
      uploadedUrl?: string,
      dbRecordId?: string
    ) => {
      setQueuedFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? { ...f, status, progress, error, uploadedUrl, dbRecordId }
            : f
        )
      );
    },
    []
  );

  // Upload single file with sort_order
  const uploadFile = useCallback(
    async (queuedFile: QueuedFile, sortOrder: number): Promise<void> => {
      const supabase = createClient();
      const fileExt = queuedFile.file.name.split('.').pop() || 'jpg';
      const fileName = `${userId}/photo-${Date.now()}-${queuedFile.id.slice(0, 8)}.${fileExt}`;

      updateFileStatus(queuedFile.id, 'uploading', 50);

      const { error: uploadError } = await supabase.storage
        .from('gallery-images')
        .upload(fileName, queuedFile.file);

      if (uploadError) {
        updateFileStatus(queuedFile.id, 'error', 0, uploadError.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('gallery-images').getPublicUrl(fileName);

      // Insert database record with sort_order
      const { data: dbRecord, error: dbError } = await supabase
        .from('gallery_images')
        .insert({
          uploaded_by: userId,
          image_url: publicUrl,
          is_approved: true, // Admin uploads are auto-approved
          sort_order: sortOrder,
        })
        .select('id')
        .single();

      if (dbError) {
        updateFileStatus(queuedFile.id, 'error', 0, dbError.message);
        return;
      }

      updateFileStatus(
        queuedFile.id,
        'uploaded',
        100,
        undefined,
        publicUrl,
        dbRecord.id
      );
    },
    [userId, updateFileStatus]
  );

  // Upload all pending files
  const uploadAll = useCallback(async () => {
    const pendingFiles = queuedFiles.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    // Get max sort_order from database to continue sequence
    const supabase = createClient();
    const { data: maxOrderData } = await supabase
      .from('gallery_images')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const startSortOrder = (maxOrderData?.sort_order ?? 0) + 1;

    // Upload 3 at a time for speed, preserving order
    const concurrency = 3;
    for (let i = 0; i < pendingFiles.length; i += concurrency) {
      const batch = pendingFiles.slice(i, i + concurrency);
      await Promise.all(
        batch.map((file, batchIndex) => {
          const globalIndex = queuedFiles.findIndex((f) => f.id === file.id);
          return uploadFile(file, startSortOrder + globalIndex);
        })
      );
    }

    setIsUploading(false);

    const uploadedCount = queuedFiles.filter((f) => f.status === 'uploaded').length + pendingFiles.length;
    const errorCount = queuedFiles.filter((f) => f.status === 'error').length;

    if (errorCount > 0) {
      toast.warning(`${uploadedCount - errorCount} photos uploaded, ${errorCount} failed`);
    } else {
      toast.success(`${pendingFiles.length} photos uploaded!`);
    }
  }, [queuedFiles, uploadFile]);

  // Retry failed upload
  const retryUpload = useCallback(
    async (id: string) => {
      const file = queuedFiles.find((f) => f.id === id);
      if (!file) return;
      const index = queuedFiles.findIndex((f) => f.id === id);
      await uploadFile(file, index);
    },
    [queuedFiles, uploadFile]
  );

  // Remove file from queue
  const removeFile = useCallback((id: string) => {
    setQueuedFiles((prev) => {
      const file = prev.find((f) => f.id === id);
      if (file) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // Clear all files
  const clearAll = useCallback(() => {
    queuedFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setQueuedFiles([]);
    setSelectedAlbum("");
    setSelectedVenue("");
    setSelectedEvent("");
  }, [queuedFiles]);

  // Apply metadata to all uploaded photos
  const applyMetadataToAll = useCallback(async () => {
    const uploadedIds = queuedFiles
      .filter((f) => f.status === 'uploaded' && f.dbRecordId)
      .map((f) => f.dbRecordId!);

    if (uploadedIds.length === 0) {
      toast.error('No uploaded photos to update');
      return;
    }

    const updates: Record<string, string | null> = {};
    if (selectedAlbum) updates.album_id = selectedAlbum;
    if (selectedVenue) updates.venue_id = selectedVenue;
    if (selectedEvent) updates.event_id = selectedEvent;

    if (Object.keys(updates).length === 0) {
      toast.error('Select at least one metadata option');
      return;
    }

    const supabase = createClient();
    const { error } = await supabase
      .from('gallery_images')
      .update(updates)
      .in('id', uploadedIds);

    if (error) {
      toast.error('Failed to update metadata');
    } else {
      toast.success(`Metadata applied to ${uploadedIds.length} photos`);
    }
  }, [queuedFiles, selectedAlbum, selectedVenue, selectedEvent]);

  // Handle complete - clear queue and refresh
  const handleComplete = useCallback(() => {
    clearAll();
    onUploadComplete();
  }, [clearAll, onUploadComplete]);

  // Drag and drop handlers for file input
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer.files.length > 0) {
        handleFilesSelected(e.dataTransfer.files);
      }
    },
    [handleFilesSelected]
  );

  // Handle drag end for reordering
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setQueuedFiles((files) => {
        const oldIndex = files.findIndex((f) => f.id === active.id);
        const newIndex = files.findIndex((f) => f.id === over.id);
        return arrayMove(files, oldIndex, newIndex);
      });
    }
  }, []);

  // Crop handlers
  const openCropModal = useCallback((file: QueuedFile) => {
    setCropTarget(file);
  }, []);

  const handleCropComplete = useCallback((croppedFile: File) => {
    if (!cropTarget) return;

    // Revoke old preview URL
    URL.revokeObjectURL(cropTarget.previewUrl);

    // Create new preview URL for cropped file
    const newPreviewUrl = URL.createObjectURL(croppedFile);

    // Update the file in queue
    setQueuedFiles((files) =>
      files.map((f) =>
        f.id === cropTarget.id
          ? { ...f, file: croppedFile, previewUrl: newPreviewUrl }
          : f
      )
    );

    setCropTarget(null);
  }, [cropTarget]);

  const handleCropCancel = useCallback(() => {
    setCropTarget(null);
  }, []);

  // Calculate progress
  const totalFiles = queuedFiles.length;
  const uploadedCount = queuedFiles.filter((f) => f.status === 'uploaded').length;
  const uploadingCount = queuedFiles.filter((f) => f.status === 'uploading').length;
  const pendingCount = queuedFiles.filter((f) => f.status === 'pending').length;
  const errorCount = queuedFiles.filter((f) => f.status === 'error').length;
  const progressPercent = totalFiles > 0 ? Math.round((uploadedCount / totalFiles) * 100) : 0;
  const allUploaded = totalFiles > 0 && uploadedCount === totalFiles;
  const hasUploaded = uploadedCount > 0;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        hidden
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(e.target.files);
          }
          e.target.value = '';
        }}
      />

      {/* Drop Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center min-h-[200px] rounded-xl border-2 border-dashed cursor-pointer transition-all ${
          isDragOver
            ? 'border-[var(--color-accent-primary)] bg-[var(--color-accent-muted)]'
            : 'border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-border-accent)] hover:bg-[var(--color-bg-tertiary)]'
        }`}
      >
        <PhotoIcon className="w-12 h-12 text-[var(--color-text-tertiary)] mb-3" />
        <p className="text-lg font-medium text-[var(--color-text-primary)]">
          Drop photos here or click to select
        </p>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Supports JPEG, PNG, WebP, GIF
        </p>
      </div>

      {/* Progress Bar */}
      {totalFiles > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-text-secondary)]">
              {isUploading
                ? `Uploading ${uploadingCount + uploadedCount} of ${totalFiles}...`
                : allUploaded
                ? `${totalFiles} photos uploaded!`
                : `${pendingCount} pending, ${uploadedCount} uploaded${errorCount > 0 ? `, ${errorCount} failed` : ''}`}
            </span>
            <span className="text-[var(--color-text-accent)] font-medium">
              {progressPercent}%
            </span>
          </div>
          <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-accent-primary)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Reorder hint */}
      {pendingCount > 1 && (
        <p className="text-xs text-[var(--color-text-tertiary)] text-center">
          Drag thumbnails to reorder before uploading. Click the crop icon to adjust framing.
        </p>
      )}

      {/* Thumbnail Grid with Drag-and-Drop */}
      {totalFiles > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={queuedFiles.map((f) => f.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {queuedFiles.map((file) => (
                <SortableThumbnail
                  key={file.id}
                  file={file}
                  onCrop={() => openCropModal(file)}
                  onRemove={() => removeFile(file.id)}
                  onRetry={() => retryUpload(file.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Metadata Section */}
      {hasUploaded && (
        <div className="p-4 bg-[var(--color-bg-secondary)] rounded-lg border border-[var(--color-border-default)] space-y-4">
          <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
            Apply to all uploaded photos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                Album
              </label>
              <select
                value={selectedAlbum}
                onChange={(e) => setSelectedAlbum(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="">Select album...</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                Venue
              </label>
              <select
                value={selectedVenue}
                onChange={(e) => setSelectedVenue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="">Select venue...</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">
                Event
              </label>
              <select
                value={selectedEvent}
                onChange={(e) => setSelectedEvent(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] text-sm focus:border-[var(--color-border-accent)] focus:outline-none"
              >
                <option value="">Select event...</option>
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={applyMetadataToAll}
            disabled={!selectedAlbum && !selectedVenue && !selectedEvent}
            className="px-4 py-2 bg-[var(--color-accent-muted)] hover:bg-[var(--color-accent-primary)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-text-primary)] hover:text-[var(--color-text-on-accent)] text-sm font-medium rounded-lg transition-colors"
          >
            Apply Metadata
          </button>
        </div>
      )}

      {/* Action Buttons */}
      {totalFiles > 0 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={clearAll}
            className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] text-sm font-medium rounded-lg border border-[var(--color-border-default)] transition-colors"
          >
            Clear All
          </button>
          <div className="flex gap-3">
            {allUploaded && (
              <button
                onClick={handleComplete}
                className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Done
              </button>
            )}
            {pendingCount > 0 && (
              <button
                onClick={uploadAll}
                disabled={isUploading}
                className="px-6 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-[var(--color-text-on-accent)] text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                {isUploading && <Spinner className="w-4 h-4" />}
                {isUploading ? 'Uploading...' : `Upload All (${pendingCount})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {cropTarget && (
        <CropModal
          file={cropTarget.file}
          aspectRatio={undefined} // Free crop - user decides
          onComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
