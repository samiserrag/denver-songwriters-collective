'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Loader2 } from 'lucide-react';

interface CropModalProps {
  file: File;
  aspectRatio?: number; // undefined = free crop
  onComplete: (croppedFile: File) => void;
  onCancel: () => void;
  onUseOriginal?: () => void; // Optional: skip cropping and use original file
}

export function CropModal({ file, aspectRatio, onComplete, onCancel, onUseOriginal }: CropModalProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isSaving, setIsSaving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Create preview URL from file - useMemo ensures proper cleanup via ref tracking
  const previewUrl = useMemo(() => URL.createObjectURL(file), [file]);

  // Cleanup object URL when component unmounts or file changes
  useEffect(() => {
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // Initialize crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;

    if (aspectRatio) {
      const initialCrop = centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          aspectRatio,
          naturalWidth,
          naturalHeight
        ),
        naturalWidth,
        naturalHeight
      );
      setCrop(initialCrop);
      setCompletedCrop(initialCrop);
    } else {
      // Free crop - start with 90% of image
      const initialCrop: Crop = { unit: '%', x: 5, y: 5, width: 90, height: 90 };
      setCrop(initialCrop);
      setCompletedCrop(initialCrop);
    }
  }, [aspectRatio]);

  // Generate cropped image file
  const getCroppedImage = useCallback(async (): Promise<File | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const pixelCrop = {
      x: (completedCrop.x / 100) * image.naturalWidth,
      y: (completedCrop.y / 100) * image.naturalHeight,
      width: (completedCrop.width / 100) * image.naturalWidth,
      height: (completedCrop.height / 100) * image.naturalHeight,
    };

    // Limit output size
    const maxSize = 1200;
    let outputWidth = pixelCrop.width;
    let outputHeight = pixelCrop.height;

    if (outputWidth > maxSize || outputHeight > maxSize) {
      const ratio = Math.min(maxSize / outputWidth, maxSize / outputHeight);
      outputWidth *= ratio;
      outputHeight *= ratio;
    }

    canvas.width = Math.round(outputWidth);
    canvas.height = Math.round(outputHeight);

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            resolve(null);
          }
        },
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop, file.name]);

  const handleSave = async () => {
    setIsSaving(true);
    const croppedFile = await getCroppedImage();
    setIsSaving(false);
    if (croppedFile) {
      onComplete(croppedFile);
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[var(--color-bg-primary)] rounded-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden border border-[var(--color-border-default)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-default)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Crop Image</h3>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[var(--color-bg-secondary)] rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Crop Area */}
        <div className="p-4 flex justify-center overflow-auto" style={{ maxHeight: '60vh' }}>
          {previewUrl && (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(_, percentCrop) => setCompletedCrop(percentCrop)}
              aspect={aspectRatio}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Native img required for ReactCrop library; next/image conflicts with crop pipeline */}
              <img
                ref={imgRef}
                src={previewUrl}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ maxHeight: '50vh' }}
              />
            </ReactCrop>
          )}
        </div>

        {/* Info text */}
        <p className="text-sm text-[var(--color-text-secondary)] text-center px-4">
          Drag to adjust the crop area. {aspectRatio ? `Fixed ${aspectRatio === 1 ? '1:1' : aspectRatio === 4/3 ? '4:3' : `${aspectRatio}:1`} ratio.` : 'Free crop - adjust to any size.'}
        </p>

        {/* Footer */}
        <div className="flex flex-col gap-3 p-4 border-t border-[var(--color-border-default)]">
          {/* Use Original Image button - prominent option */}
          {onUseOriginal && (
            <button
              type="button"
              onClick={onUseOriginal}
              disabled={isSaving}
              className="w-full px-4 py-3 rounded-lg border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-accent)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
            >
              Use Original Image (No Crop)
            </button>
          )}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              disabled={isSaving}
              className="px-4 py-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border-default)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !completedCrop}
              className="px-4 py-2 bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-text-on-accent)] rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Crop'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
