"use client";

export function DegradedModeBanner({ message }: { message: string }) {
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-amber-500 text-white text-center text-sm py-1.5 font-medium">
      ⚠ {message}
    </div>
  );
}

export function ReconnectingBanner({ message }: { message: string }) {
  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-blue-500 text-white text-center text-sm py-1.5 font-medium">
      ↻ {message}
    </div>
  );
}
