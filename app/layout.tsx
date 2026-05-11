import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundry Ops",
  description: "Laundry Operations Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he">
      <body className="min-h-screen bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
