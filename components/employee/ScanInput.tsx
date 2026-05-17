"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Camera, Keyboard, Square } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface ScanInputProps {
  onScan: (value: string) => void;
  placeholder?: string;
  cameraLabel?: string;
  stopCameraLabel?: string;
  manualLabel?: string;
  cameraErrorLabel?: string;
  autoStartCamera?: boolean;
}

export function ScanInput({
  onScan,
  placeholder = "Ready to scan...",
  cameraLabel = "Open camera",
  stopCameraLabel = "Stop camera",
  manualLabel = "Scanner input",
  cameraErrorLabel = "Camera barcode scanning is unavailable",
  autoStartCamera = false,
}: ScanInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef<{ value: string; time: number } | null>(null);
  const autoStartedRef = useRef(false);
  const [displayValue, setDisplayValue] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (cameraActive) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    const onBlur = () => setTimeout(() => input.focus(), 50);
    input.addEventListener("blur", onBlur);
    return () => input.removeEventListener("blur", onBlur);
  }, [cameraActive]);

  useEffect(() => stopCamera, [stopCamera]);

  const emitScan = useCallback(
    (value: string) => {
      const val = value.trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, "");
      if (val.length < 8) return false;

      const now = Date.now();
      if (
        lastScanRef.current &&
        lastScanRef.current.value === val &&
        now - lastScanRef.current.time < 2000
      ) {
        return false;
      }

      lastScanRef.current = { value: val, time: now };
      onScan(val);
      setDisplayValue("");
      if (inputRef.current) inputRef.current.value = "";
      return true;
    },
    [onScan]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(cameraErrorLabel);
      return;
    }

    try {
      stopCamera();
      setCameraActive(true);
      const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatOneDReader();
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current ?? undefined,
        (result) => {
          if (!result) return;
          if (emitScan(result.getText())) {
            stopCamera();
          }
        }
      );
      scannerControlsRef.current = controls;
    } catch {
      setCameraActive(false);
      setCameraError(cameraErrorLabel);
    }
  }, [cameraErrorLabel, emitScan, stopCamera]);

  useEffect(() => {
    if (!autoStartCamera || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startCamera();
  }, [autoStartCamera, startCamera]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      emitScan(inputRef.current?.value ?? "");
    },
    [emitScan]
  );

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
        <input
          ref={inputRef}
          type="text"
          autoFocus
          className="absolute inset-0 h-full w-full cursor-default opacity-0"
          onKeyDown={handleKeyDown}
          onChange={(e) => setDisplayValue(e.target.value)}
          aria-label="Barcode scanner input"
        />

        <div className={cameraActive ? "block" : "hidden"}>
          <video
            ref={videoRef}
            className="h-56 w-full bg-black object-cover"
            muted
            playsInline
          />
        </div>

        {!cameraActive && (
          <div className="flex items-center gap-3 px-4 py-3">
            <Keyboard className="h-5 w-5 text-gray-500" aria-hidden="true" />
            <span className="text-sm text-gray-500">{displayValue || placeholder}</span>
          </div>
        )}
      </div>

      {cameraError && (
        <p className="text-sm text-red-600">{cameraError}</p>
      )}

      <Button
        type="button"
        variant={cameraActive ? "danger" : "secondary"}
        size="md"
        className="w-full gap-2"
        onClick={cameraActive ? stopCamera : startCamera}
      >
        {cameraActive ? (
          <Square className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Camera className="h-4 w-4" aria-hidden="true" />
        )}
        {cameraActive ? stopCameraLabel : cameraLabel}
      </Button>

      <p className="text-xs text-gray-500">{manualLabel}</p>
    </div>
  );
}
