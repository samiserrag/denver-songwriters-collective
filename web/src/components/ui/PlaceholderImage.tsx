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
  const gradients = {
    "open-mic": "from-purple-900 via-indigo-900 to-blue-900",
    "event": "from-amber-900 via-orange-900 to-red-900",
    "performer": "from-teal-900 via-cyan-900 to-blue-900",
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
        <p className="text-white/30 text-xs mt-2 uppercase tracking-wider">DSC</p>
      </div>
    </div>
  );
}
