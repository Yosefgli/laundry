"use client";
import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function CustomerEntryPage() {
  const [pairingCode, setPairingCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (pairingCode.length !== 6) return;
    setLoading(true);
    setError(null);

    const customerDeviceId = `customer-${crypto.randomUUID()}`;

    const res = await fetch("/api/sessions/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode, customerDeviceId }),
    });
    const json = await res.json();
    if (json.data) {
      window.location.href = `/customer/${json.data.id}?device=${customerDeviceId}`;
    } else {
      setError(json.error ?? "Invalid pairing code");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border shadow-sm p-8 space-y-6 text-center">
        <h1 className="text-2xl font-bold">Enter Pairing Code</h1>
        <p className="text-gray-500 text-sm">Enter the 6-digit code shown on the employee screen</p>
        <Input
          value={pairingCode}
          onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="text-center text-3xl tracking-widest font-bold"
          maxLength={6}
          inputMode="numeric"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button
          size="xl"
          className="w-full"
          onClick={handleJoin}
          loading={loading}
          disabled={pairingCode.length !== 6}
        >
          Join Session
        </Button>
      </div>
    </div>
  );
}
