"use client";
import { useEffect, useRef } from "react";

interface BarcodeProps {
  value: string;       // order UUID
  width?: number;
  height?: number;
  className?: string;
}

export function Barcode({ value, width = 280, height = 80, className }: BarcodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    import("bwip-js").then((bwipjs) => {
      const canvas = document.createElement("canvas");
      try {
        bwipjs.toCanvas(canvas, {
          bcid: "code128",
          text: value,
          scale: 2,
          height: 12,
          includetext: false,
          backgroundcolor: "ffffff",
        });
        containerRef.current!.innerHTML = "";
        containerRef.current!.appendChild(canvas);
      } catch {
        if (containerRef.current) {
          containerRef.current.innerHTML = `<p class="text-xs text-red-500">Barcode error</p>`;
        }
      }
    });
  }, [value]);

  return <div ref={containerRef} style={{ width, height }} className={className} />;
}
