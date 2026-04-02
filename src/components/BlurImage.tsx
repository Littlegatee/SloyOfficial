import { useState } from "react";

type BlurImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
  /** Default: contain (post media); use cover for avatars/thumbs */
  objectFit?: "contain" | "cover";
};

/** Blur-up + fade-in for remote images (feed, chat media). */
export default function BlurImage({
  src,
  alt,
  className = "",
  loading = "lazy",
  objectFit = "contain",
}: BlurImageProps) {
  const [loaded, setLoaded] = useState(false);
  const fit = objectFit === "cover" ? "object-cover" : "object-contain";

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {!loaded && (
        <span
          className="absolute inset-0 bg-muted/50 animate-pulse"
          aria-hidden
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`relative z-[1] w-full h-full ${fit} transition-[filter,opacity,transform] duration-500 ease-out ${
          loaded ? "opacity-100 blur-0 scale-100" : "opacity-0 blur-md scale-105"
        }`}
      />
    </span>
  );
}
