import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/barlow-condensed/500.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: { default: "Geoffroy Fitness Training", template: "%s · Geoffroy Fitness Training" },
  description: "Espace privé de coaching : clients, programmes, performances et suivi de poids.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "GF Training", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#07080B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
