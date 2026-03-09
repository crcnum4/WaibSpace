import { useState } from "react";
import type { BlockProps } from "../../registry";

export function Image({ block }: BlockProps) {
  const { src, alt = "", width, height, aspectRatio, fallback = "Image" } =
    block.props as {
      src: string;
      alt?: string;
      width?: string;
      height?: string;
      aspectRatio?: string;
      fallback?: string;
    };

  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  // Only inline styles for truly dynamic per-instance values
  const wrapperStyle: React.CSSProperties = {};
  if (width) wrapperStyle.width = width;
  if (height) wrapperStyle.height = height;
  if (aspectRatio) wrapperStyle.aspectRatio = aspectRatio;

  return (
    <div
      className="block-image"
      style={Object.keys(wrapperStyle).length > 0 ? wrapperStyle : undefined}
    >
      {status === "loading" && (
        <div className="block-image__loading">Loading...</div>
      )}
      {status === "error" ? (
        <div
          className="block-image__error"
          style={height ? { height } : undefined}
        >
          {fallback}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          className={`block-image__img${status === "loaded" ? " block-image__img--loaded" : ""}`}
        />
      )}
    </div>
  );
}
