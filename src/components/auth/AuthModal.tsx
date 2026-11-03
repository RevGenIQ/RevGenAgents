"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { RevGenLogo } from "@/components/ui/RevGenLogo";
import { AuthForm } from "./AuthForm";

export function AuthModal() {
  const router = useRouter();
  const { isAuthModalOpen, closeAuthModal, authModalMode, openAuthModal } = useAuth();

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAuthModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={closeAuthModal} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative z-10 w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl text-slate-900"
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <RevGenLogo className="w-7 h-7 text-indigo-600" />
            <h2 id="auth-modal-title" className="text-sm font-semibold">
              {authModalMode === "signin" ? "Sign in to RevGen IQ" : "Create your RevGen IQ workspace"}
            </h2>
          </div>
          <button type="button" onClick={closeAuthModal} aria-label="Close"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">
          <AuthForm
            mode={authModalMode}
            onModeChange={(m) => openAuthModal(m)}
            onSuccess={(url) => {
              closeAuthModal();
              router.push(url);
            }}
            tone="light"
          />
        </div>
      </div>
    </div>
  );
}
