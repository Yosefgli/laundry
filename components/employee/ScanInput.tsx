"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface ScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
}

export function ScanInput({ onScan, placeholder = "Ready to scan…" }: ScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastScanRef = useRef<{ value: string; time: number } | null>(null);
  const [displayValue, setDisplayValue] = useState("");

  // Reclaim focus if clicked away
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const onBlur = () => setTimeout(() => input.focus(), 50);
    input.addEventListener("blur", onBlur);
    return () => input.removeEventListener("blur", onBlur);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const val = inputRef.current?.value.trim() ?? "";
      if (val.length < 36) return;

      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.value === val &&
        now - lastScanRef.current.time < 2000
      ) {
        return;
      }

      lastScanRef.current = { value: val, time: now };
      onScan(val);
      setDisplayValue("");
      if (inputRef.current) inputRef.current.value = "";
    },
    [onScan]
  );

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        autoFocus
        className="opacity-0 absolute inset-0 w-full h-full cursor-default"
        onKeyDown={handleKeyDown}
        onChange={(e) => setDisplayValue(e.target.value)}
        aria-label="Barcode scanner input"
      />
      <div className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-xl px-4 py-3 bg-gray-50">
        <span className="text-2xl">📷</span>
        <span className="text-gray-500 text-sm">{displayValue || placeholder}</span>
      </div>
    </div>
  );
}
