import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthBar } from "@/components/AuthBar";
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
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-dvh min-h-0 antialiased`}>
      <body className="flex h-full min-h-0 flex-col overflow-hidden">
        <DisablePinchZoom />
        <Providers>
          <div className="flex min-h-0 flex-1 flex-col">
            <AuthBar />
            <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
