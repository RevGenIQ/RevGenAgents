"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { AuthForm, type AuthMode } from "./AuthForm";

interface AuthSplitViewProps {
  initialMode?: AuthMode;
}

const SAMPLE_INCLUDES = [
  "5 companies matched to your ICP, researched live while you watch",
  "Firmographics: size, industry, HQ, funding, tech stack",
  "Dated buying signals, each linked to its source",
  "Why each account fits and what to pitch them",
];

export function AuthSplitView({ initialMode = "signin" }: AuthSplitViewProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  return (
    <div className="min-h-screen w-full bg-[#0a0f1c] text-white flex flex-col">
      <header className="px-6 lg:px-10 py-5 border-b border-white/10">
        <Link href="/" className="inline-flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-black border border-white/15 flex items-center justify-center p-1.5">
            <RevGenLogo className="w-full h-full" />
          </span>
          <span className="font-semibold text-lg tracking-tight">RevGen IQ</span>
        </Link>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_480px] gap-10 px-6 lg:px-10 py-10 max-w-6xl w-full mx-auto">
        <section className="hidden lg:flex flex-col justify-center">
          <p className="text-sm font-medium text-indigo-300 mb-3">Free sample, no card needed</p>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight max-w-md">
            See five accounts researched for your ICP before you commit.
          </h1>
          <ul className="mt-8 space-y-3 max-w-md">
            {SAMPLE_INCLUDES.map((item) => (
              <li key={item} className="flex gap-3 text-slate-300 text-[15px] leading-relaxed">
                <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-slate-400 max-w-md leading-relaxed">
            Like what you see? The plan delivers 35 researched and human-enriched accounts every month.
          </p>
        </section>

        <section className="w-full max-w-[480px] mx-auto lg:mx-0 self-center rounded-xl bg-[#0f1628] border border-white/10 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your workspace"}
          </h2>
          <p className="text-sm text-slate-400 mt-1.5 mb-6">
            {mode === "signin"
              ? "Sign in to your RevGen IQ workspace."
              : "Takes a minute. Your 5 free sample accounts are waiting on the dashboard."}
          </p>
          <AuthForm mode={mode} onModeChange={setMode} onSuccess={(url) => router.push(url)} tone="dark" />
        </section>
      </main>
    </div>
  );
}
