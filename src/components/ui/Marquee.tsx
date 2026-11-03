import React from "react";

interface MarqueeProps {
  children: React.ReactNode;
  /** Seconds for one full loop of the track. Larger is slower. */
  durationSeconds?: number;
  /** Gap between items, in pixels. Also used between the duplicated tracks. */
  gapPx?: number;
  pauseOnHover?: boolean;
  /** Fade the left/right edges into the background. */
  fadeEdges?: boolean;
  className?: string;
  ariaLabel?: string;
}

/**
 * Horizontal right-to-left marquee. The track is rendered twice and shifted
 * by exactly one track width, so the loop is seamless. Under
 * `prefers-reduced-motion` the animation stops, the duplicate is hidden and
 * the row scrolls manually instead (see `.marquee` rules in globals.css).
 */
export function Marquee({
  children,
  durationSeconds = 40,
  gapPx = 16,
  pauseOnHover = true,
  fadeEdges = true,
  className = "",
  ariaLabel,
}: MarqueeProps) {
  const style = {
    "--marquee-duration": `${durationSeconds}s`,
    "--marquee-gap": `${gapPx}px`,
  } as React.CSSProperties;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      style={style}
      className={`marquee ${pauseOnHover ? "marquee--pausable" : ""} ${
        fadeEdges ? "marquee--fade" : ""
      } ${className}`}
    >
      <div className="marquee__track">{children}</div>
      {/* Visual duplicate only: hidden from assistive tech and the tab order. */}
      <div className="marquee__track" aria-hidden="true" inert>
        {children}
      </div>
    </div>
  );
}
