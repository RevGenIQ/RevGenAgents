"use client";

import { useRouter } from "next/navigation";
import { LandingPage } from "@/components/landing/LandingPage";

export function LandingPreview() {
  const router = useRouter();
  return <LandingPage onEnterApp={() => router.push("/")} />;
}
