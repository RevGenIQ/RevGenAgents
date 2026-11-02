"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { BadgeCheck, Radio } from "lucide-react";

// WebGL only runs in the browser; the poster keeps the layout stable while it loads.
const SignalGraphScene = dynamic(() => import("./SignalGraphScene"), {
  ssr: false,
  loading: () => <GraphPoster />,
});

function GraphPoster() {
  return (
    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="w-56 h-56 rounded-full border border-indigo-300/15 bg-[radial-gradient(circle,rgba(91,75,255,0.35)_0%,rgba(91,75,255,0)_60%)]" />
    </div>
  );
}

/**
 * 3D "signal graph": company nodes on a slowly rotating shell, with buying-signal
 * pulses converging on a verified account. Still image when reduced motion is set.
 */
export function SignalGraphHero() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative w-full h-full">
      <SignalGraphScene animate={!reduceMotion} />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        className="pointer-events-none absolute left-1/2 bottom-3 -translate-x-1/2 sm:bottom-auto sm:top-1/2 sm:translate-x-10 sm:translate-y-10 w-[220px] rounded-2xl border border-white/15 bg-[#0B0730]/80 backdrop-blur-md p-3.5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-2 text-[11px] font-semibold text-white">
          <BadgeCheck className="w-4 h-4 text-[#7C8CFF]" />
          Verified account card
        </div>
        <ul className="mt-2.5 space-y-1.5 text-[11px] leading-snug text-white/70">
          <li className="flex items-start gap-1.5">
            <Radio className="w-3 h-3 mt-0.5 shrink-0 text-[#F5B544]" />
            Dated buying signal, with its source
          </li>
          <li className="flex items-start gap-1.5">
            <Radio className="w-3 h-3 mt-0.5 shrink-0 text-[#F5B544]" />
            Decision maker&apos;s role confirmed
          </li>
          <li className="flex items-start gap-1.5">
            <Radio className="w-3 h-3 mt-0.5 shrink-0 text-[#F5B544]" />
            Email checked, then human-reviewed
          </li>
        </ul>
      </motion.div>
    </div>
  );
}
