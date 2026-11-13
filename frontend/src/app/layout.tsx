import type { Metadata, Viewport } from "next";
import { Big_Shoulders, Instrument_Serif, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Self-hosted by Next at build time: no render-blocking request to Google Fonts.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

// The app name is always set in this condensed signage face (also used for stamps and big numerals).
const wordmark = Big_Shoulders({
  subsets: ["latin"],
  weight: ["800", "900"],
  variable: "--font-wordmark",
  display: "swap",
});
// Display headlines on the public pages.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const DESCRIPTION =
  "ThermaTrust is a trust and compliance layer for commercial HVAC/refrigeration work: verified technician passports, risk-based job matching, cylinder-level refrigerant tracking and a tamper-evident audit trail.";

export const metadata: Metadata = {
  title: { default: "ThermaTrust | Verified for the job. Not just certified.", template: "%s | ThermaTrust" },
  description: DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "ThermaTrust",
    description: DESCRIPTION,
    siteName: "ThermaTrust",
    type: "website",
  },
  appleWebApp: { capable: true, title: "ThermaTrust", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${wordmark.variable} ${serif.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
