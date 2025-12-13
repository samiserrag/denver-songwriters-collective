import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Playfair_Display, Inter } from "next/font/google";
import { Header, Footer } from "@/components/navigation";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const siteUrl = "https://denver-songwriters-collective.vercel.app";

export const viewport: Viewport = {
  themeColor: "#d4a853",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Denver Songwriters Collective",
    template: "%s | Denver Songwriters Collective",
  },
  description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DSC",
  },
  formatDetection: {
    telephone: false,
  },
  keywords: [
    "Denver songwriters",
    "open mics Denver",
    "songwriter community",
    "Denver music scene",
    "live music Denver",
    "songwriter showcase",
    "Colorado musicians",
    "Denver open mic nights",
  ],
  authors: [{ name: "Denver Songwriters Collective" }],
  creator: "Denver Songwriters Collective",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Denver Songwriters Collective",
    title: "Denver Songwriters Collective",
    description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Denver Songwriters Collective - Find your people. Find your stage. Find your songs.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Denver Songwriters Collective",
    description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
    images: ["/images/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add Google Search Console verification if available
    // google: "your-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains for faster asset loading */}
        <link rel="preconnect" href="https://oipozdbfxyskoscsgbfq.supabase.co" />
        <link rel="dns-prefetch" href="https://oipozdbfxyskoscsgbfq.supabase.co" />

        {/*
          Note: The hero image LCP is optimized via next/image with priority prop.
          Next.js automatically handles preload and format optimization (WebP/AVIF).
          Manual preload removed to avoid duplicate requests and let Next.js handle it.
        */}

        {/* Critical CSS for above-the-fold content to prevent render blocking */}
        <style dangerouslySetInnerHTML={{ __html: `
          /* Critical hero section styles */
          .h-\\[500px\\] { height: 500px !important; }
          .h-\\[400px\\] { height: 400px !important; }
          .h-\\[300px\\] { height: 300px !important; }
          @media (min-width: 768px) {
            .md\\:h-\\[600px\\] { height: 600px !important; }
            .md\\:h-\\[300px\\] { height: 300px !important; }
          }
          .object-cover { object-fit: cover; }
          .object-center { object-position: center; }

          /* Critical header styles */
          .sticky { position: sticky; }
          .top-0 { top: 0; }
          .z-50 { z-index: 50; }

          /* Critical layout */
          .relative { position: relative; }
          .absolute { position: absolute; }
          .inset-0 { inset: 0; }
          .w-full { width: 100%; }
          .overflow-hidden { overflow: hidden; }
          .flex { display: flex; }
          .items-center { align-items: center; }
          .justify-center { justify-content: center; }
          .justify-between { justify-content: space-between; }

          /* Footer - reserve adequate space to prevent CLS */
          footer { min-height: 650px !important; }
          @media (min-width: 768px) { footer { min-height: 280px !important; } }
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} antialiased`}
      >
        <Header />
        {children}
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
