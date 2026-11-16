import { useState } from "react";

// Shows an image icon from /public. If the image is missing or fails to load, the emoji
// given as `fallback` is shown instead, so a screen never ends up with a broken picture.
export default function Icon({ src, fallback = "", className = "h-4 w-4", alt = "", style }) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback ? <span aria-hidden={alt ? undefined : true}>{fallback}</span> : null;
  return (
    <img
      src={src}
      alt={alt}
      className={`inline-block shrink-0 object-contain align-[-0.15em] ${className}`}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}
