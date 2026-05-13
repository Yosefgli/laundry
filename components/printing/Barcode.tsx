"use client";
import { useEffect, useRef } from "react";
import * as bwipjs from "bwip-js";

interface BarcodeProps {
  value: string;       // order UUID
  size?: number;
  className?: string;
}

export function Barcode({ value, size = 160, className }: BarcodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement("canvas");
    try {
      bwipjs.toCanvas(canvas, {
        bcid: "qrcode",
        text: value,
        scale: 4,
        backgroundcolor: "ffffff",
      });
      containerRef.current.innerHTML = "";
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      containerRef.current.appendChild(canvas);
    } catch {
      if (containerRef.current) {
        containerRef.current.innerHTML = `<p class="text-xs text-red-500">QR error</p>`;
      }
    }
  }, [value, size]);

  return <div ref={containerRef} style={{ width: size, height: size }} className={className} />;
}
