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

  return (
    <div
      className="block-image"
      style={{ width: width ?? "100%", height, aspectRatio, position: "relative" }}
    >
      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-muted)",
            fontSize: "var(--text-sm)",
            borderRadius: "var(--radius-sm, 4px)",
          }}
        >
          Loading...
        </div>
      )}
      {status === "error" ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: height ?? 120,
            backgroundColor: "var(--color-surface)",
            color: "var(--color-muted)",
            fontSize: "var(--text-sm)",
            borderRadius: "var(--radius-sm, 4px)",
          }}
        >
          {fallback}
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("error")}
          style={{
            display: status === "loaded" ? "block" : "none",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "var(--radius-sm, 4px)",
          }}
        />
      )}
    </div>
  );
}
