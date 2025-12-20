'use client';

import { useState, useRef, useCallback } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, X, Camera, Loader2 } from 'lucide-react';

type ImageUploadProps = {
  currentImageUrl?: string | null;
  onUpload: (file: File) => Promise<string | null>;
  onRemove?: () => Promise<void>;
  aspectRatio?: number;
  maxSizeMB?: number;
  className?: string;
  shape?: 'circle' | 'square';
  placeholderText?: string;
};

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  );
}

export function ImageUpload({
  currentImageUrl,
  onUpload,
  onRemove,
  aspectRatio = 4/3,
  maxSizeMB = 5,
  className = '',
  shape = 'circle',
  placeholderText = 'Upload Image',
}: ImageUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCropper, setShowCropper] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const originalFileRef = useRef<File | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateFile = (file: File): string | null => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return 'Please upload a JPG, PNG, WebP, or GIF image.';
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Image must be smaller than ${maxSizeMB}MB.`;
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setError(null);
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    originalFileRef.current = file;
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
      setShowCropper(true);
    };
    reader.readAsDataURL(file);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSizeMB]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files?.[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.[0]) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspectRatio));
  }, [aspectRatio]);

  const getCroppedImage = useCallback(async (): Promise<File | null> => {
    if (!imgRef.current || !completedCrop) return null;

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelCrop = {
      x: (completedCrop.x / 100) * image.width * scaleX,
      y: (completedCrop.y / 100) * image.height * scaleY,
      width: (completedCrop.width / 100) * image.width * scaleX,
      height: (completedCrop.height / 100) * image.height * scaleY,
    };

    // Output size - max 1200px wide for all images, 800px for avatars (1:1)
    const isSquare = Math.abs(pixelCrop.width - pixelCrop.height) < 1;
    const maxDimension = isSquare ? 800 : 1200;
    let outputWidth: number;
    let outputHeight: number;

    if (pixelCrop.width >= pixelCrop.height) {
      outputWidth = Math.min(maxDimension, pixelCrop.width);
      outputHeight = outputWidth / (pixelCrop.width / pixelCrop.height);
    } else {
      outputHeight = Math.min(maxDimension, pixelCrop.height);
      outputWidth = outputHeight * (pixelCrop.width / pixelCrop.height);
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
          if (!blob) {
            resolve(null);
            return;
          }
          const fileName = originalFileRef.current?.name || 'image.jpg';
          const file = new File([blob], fileName, { type: 'image/jpeg' });
          resolve(file);
        },
        'image/jpeg',
        0.9
      );
    });
  }, [completedCrop]);

  const handleCropComplete = useCallback(async () => {
    setIsUploading(true);
    setError(null);

    try {
      const croppedFile = await getCroppedImage();
      if (!croppedFile) {
        setError('Failed to crop image. Please try again.');
        setIsUploading(false);
        return;
      }

      const uploadedUrl = await onUpload(croppedFile);
      if (uploadedUrl) {
        setShowCropper(false);
        setPreviewUrl(null);
      } else {
        setError('Failed to upload image. Please try again.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [getCroppedImage, onUpload]);

  const handleCancel = useCallback(() => {
    setShowCropper(false);
    setPreviewUrl(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    originalFileRef.current = null;
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const handleRemove = useCallback(async () => {
    if (onRemove) {
      setIsUploading(true);
      try {
        await onRemove();
      } catch (err) {
        console.error('Remove error:', err);
        setError('Failed to remove image.');
      } finally {
        setIsUploading(false);
      }
    }
  }, [onRemove]);

  // Cropper modal
  if (showCropper && previewUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
        <div className="bg-[var(--color-bg-primary)] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto border border-[var(--color-border-default)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
              Crop Your Image
            </h3>
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Cancel"
            >
              <X className="w-5 h-5 text-[var(--color-text-secondary)]" />
            </button>
          </div>

          <div className="mb-4 flex flex-col md:flex-row gap-4 items-start justify-center">
            {/* Crop area */}
            <div className="flex-1">
              <p className="text-xs text-[var(--color-text-tertiary)] mb-2 text-center">Drag to select crop area</p>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(_, percentCrop) => setCompletedCrop(percentCrop)}
                aspect={aspectRatio}
                circularCrop={shape === 'circle'}
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[40vh] w-auto mx-auto"
                />
              </ReactCrop>
            </div>

            {/* Live preview */}
            {completedCrop && imgRef.current && (
              <div className="flex flex-col items-center">
                <p className="text-xs text-[var(--color-text-tertiary)] mb-2">Final result preview</p>
                <div
                  className={`overflow-hidden border-2 border-[var(--color-border-accent)] ${shape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
                  style={{
                    width: 120,
                    height: aspectRatio === 1 ? 120 : Math.round(120 / aspectRatio),
                  }}
                >
                  <div
                    style={{
                      width: `${100 / (completedCrop.width / 100)}%`,
                      marginLeft: `-${(completedCrop.x / completedCrop.width) * 100}%`,
                      marginTop: `-${(completedCrop.y / completedCrop.height) * 100}%`,
                    }}
                  >
                    <img
                      src={previewUrl}
                      alt="Final preview"
                      style={{
                        width: '100%',
                        height: 'auto',
                        display: 'block',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-sm text-[var(--color-text-secondary)] mb-4 text-center">
            {aspectRatio === 1 ? (
              <>Cropping to <strong>square (1:1)</strong>. Output: 800×800px max.</>
            ) : Math.abs(aspectRatio - 4/3) < 0.01 ? (
              <>Cropping to <strong>4:3</strong>. Output: 1200×900px. Most phone photos are already 4:3.</>
            ) : aspectRatio === 16/9 ? (
              <>Cropping to <strong>16:9</strong>. Output: 1200×675px max.</>
            ) : aspectRatio === 3/2 ? (
              <>Cropping to <strong>3:2</strong>. Output: 1200×800px max.</>
            ) : (
              <>Cropping to <strong>{Math.round(aspectRatio * 10) / 10}:1</strong> aspect ratio.</>
            )}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isUploading}
              className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-[var(--color-text-secondary)] hover:border-white/40 hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCropComplete}
              disabled={isUploading || !completedCrop}
              className="flex-1 px-4 py-3 rounded-lg bg-[var(--color-accent-primary)] hover:bg-[var(--color-accent-hover)] text-[var(--color-background)] font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main upload area
  return (
    <div className={`relative ${className}`}>
      {/* Current image or placeholder */}
      <div
        className={`relative group ${
          shape === 'circle' ? 'rounded-full' : 'rounded-xl'
        } overflow-hidden bg-[var(--color-bg-secondary)] border-2 border-dashed transition-colors ${
          dragActive
            ? 'border-[var(--color-border-accent)] bg-[var(--color-accent-primary)]/10'
            : 'border-[var(--color-border-default)] hover:border-[var(--color-border-accent)]'
        }`}
        style={{ aspectRatio: '1 / 1' }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt="Profile"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                aria-label="Change image"
              >
                <Camera className="w-5 h-5 text-[var(--color-text-primary)]" />
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="p-3 bg-red-500/50 hover:bg-red-500/70 rounded-full transition-colors"
                  aria-label="Remove image"
                >
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-[var(--color-text-primary)] animate-spin" />
                  ) : (
                    <X className="w-5 h-5 text-[var(--color-text-primary)]" />
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-accent)] transition-colors"
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <>
                <Upload className="w-8 h-8" />
                <span className="text-sm font-medium">{placeholderText}</span>
                <span className="text-xs opacity-60">
                  or drag & drop
                </span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleChange}
        className="hidden"
      />

      {error && (
        <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
