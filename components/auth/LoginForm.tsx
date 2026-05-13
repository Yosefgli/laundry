"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { TranslationMap } from "@/lib/i18n";

export function LoginForm({ translations: t }: { translations: TranslationMap }) {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push("/employee");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center text-white space-y-3">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-3xl backdrop-blur-sm">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Washing machine body */}
              <rect x="4" y="8" width="36" height="32" rx="4" stroke="white" strokeWidth="2.5" fill="none"/>
              {/* Control panel */}
              <rect x="4" y="8" width="36" height="9" rx="4" fill="white" fillOpacity="0.25"/>
              <rect x="10" y="11" width="10" height="3" rx="1.5" fill="white" fillOpacity="0.6"/>
              <circle cx="32" cy="12.5" r="2" fill="white"/>
              <circle cx="37" cy="12.5" r="2" fill="white"/>
              {/* Drum circle */}
              <circle cx="22" cy="28" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
              <circle cx="22" cy="28" r="6" stroke="white" strokeWidth="1.5" fill="none" strokeDasharray="3 2"/>
              {/* Bubbles */}
              <circle cx="7" cy="4" r="2" fill="white" fillOpacity="0.7"/>
              <circle cx="3" cy="8" r="1.5" fill="white" fillOpacity="0.5"/>
              <circle cx="11" cy="2" r="1" fill="white" fillOpacity="0.4"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight">Laundry</h1>
            <p className="text-white/75 text-sm font-medium">By Chabad</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          <p className="text-center text-sm text-gray-500 font-medium">{t["auth.login_title"]}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label={t["auth.email"]}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Input
              label={t["auth.password"]}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            {error && (
              <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
              {t["auth.sign_in"]}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
