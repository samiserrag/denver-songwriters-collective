interface PlaceholderImageProps {
  type?: "open-mic" | "event" | "performer" | "studio";
  className?: string;
  alt?: string;
}

export default function PlaceholderImage({
  type = "open-mic",
  className = "",
  alt = "Placeholder"
}: PlaceholderImageProps) {
  // Use actual image for open-mic type
  if (type === "open-mic") {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src="/images/open-mic-placeholder.jpg"
          alt={alt}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>
    );
  }

  const gradients = {
    "open-mic": "from-purple-900 via-indigo-900 to-blue-900",
    "event": "from-amber-900 via-orange-900 to-red-900",
    "performer": "from-amber-900 via-yellow-900 to-orange-900",
    "studio": "from-neutral-800 via-neutral-900 to-black",
  };

  const icons = {
    "open-mic": "🎤",
    "event": "🎵",
    "performer": "🎸",
    "studio": "🎧",
  };

  return (
    <div
      className={`bg-gradient-to-br ${gradients[type]} flex items-center justify-center ${className}`}
      role="img"
      aria-label={alt}
    >
      <div className="text-center">
        <span className="text-5xl opacity-50">{icons[type]}</span>
        <p className="text-[var(--color-text-primary)]/30 text-xs mt-2 uppercase tracking-wider">DSC</p>
      </div>
    </div>
  );
}
