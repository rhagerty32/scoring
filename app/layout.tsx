import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DisablePinchZoom } from "@/components/DisablePinchZoom";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Good Game — Nertz scoring",
  description: "Create a room, share a link, and log each round from your own phone. Rounds lock when everyone has saved.",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "Good Game",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  /** Keeps the layout from resizing under the software keyboard when possible (Chrome on Android). */
  interactiveWidget: "overlays-content",
  themeColor: "#17120f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <DisablePinchZoom />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
