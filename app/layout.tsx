import type { Metadata } from "next";
import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Laundry POS",
  description: "Laundry Point of Sale Management System",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Laundry POS",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir, translations } = await getI18n();

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
        <Suspense fallback={null}>
          <LanguageSwitcher locale={locale} translations={translations} />
        </Suspense>
      </body>
    </html>
  );
}
