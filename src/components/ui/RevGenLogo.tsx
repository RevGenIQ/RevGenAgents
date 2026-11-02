import React from "react";

interface RevGenLogoProps {
  className?: string;
  size?: number;
  color?: string;
  animated?: boolean;
}

/**
 * RevGen B2Bos Origami "R" Brand Logo
 * Geometric faceted vector glyph with rich gradient shaders and ambient animation
 */
export function RevGenLogo({
  className = "w-7 h-7",
  size,
  color,
  animated = false,
}: RevGenLogoProps) {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${animated ? "transition-transform duration-300" : ""}`}
      style={style}
      aria-label="HUNT SMARTER Logo"
    >
      <defs>
        {/* Shimmer and 3D Facet Gradients */}
        <linearGradient id="facet1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        <linearGradient id="facet2Grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>

        <linearGradient id="facet3Grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>

        <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient background glow ring if animated */}
      {animated && (
        <circle
          cx="50"
          cy="50"
          r="42"
          stroke="url(#facet2Grad)"
          strokeWidth="1.5"
          strokeDasharray="4 6"
          className="opacity-40 animate-[spin_12s_linear_infinite]"
        />
      )}

      {/* Facet 1: Left Chevron Arrow & Downward Stem */}
      <polygon
        points="50,15 24,36 34,54 21,88 32,82 46,38"
        fill={color || "url(#facet1Grad)"}
        filter={animated ? "url(#logoGlow)" : undefined}
      />

      {/* Facet 2: Upper Loop of the 'R' */}
      <polygon
        points="52,15 78,38 52,68 43,58 48,34"
        fill={color || "url(#facet2Grad)"}
        filter={animated ? "url(#logoGlow)" : undefined}
      />

      {/* Facet 3: Diagonal Right Leg */}
      <polygon
        points="42,61 68,88 50,88 36,73"
        fill={color || "url(#facet3Grad)"}
      />
    </svg>
  );
}
