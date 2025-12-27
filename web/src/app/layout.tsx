import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Playfair_Display, Inter, Fraunces } from "next/font/google";
import { Header, Footer } from "@/components/navigation";
import { Toaster } from "sonner";
import { getSiteSettings } from "@/lib/site-settings";
import { ThemeInitializer } from "@/components/ui/ThemeInitializer";
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

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch site-wide default theme/font from database
  const siteSettings = await getSiteSettings();

  // Build data attributes for SSR
  const dataTheme = siteSettings.themePreset || undefined;
  const dataFont = siteSettings.fontPreset || undefined;

  return (
    <html
      lang="en"
      data-theme={dataTheme}
      data-font={dataFont}
      suppressHydrationWarning
    >
      <head>
        {/* Pre-hydration theme script - runs before React to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("dsc-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`,
          }}
        />
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
            .md\\:h-\\[500px\\] { height: 500px !important; }
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

          /* Aspect ratio for image containers - critical for CLS prevention */
          .aspect-\\[4\\/3\\] { aspect-ratio: 4/3; }
          .aspect-\\[16\\/9\\] { aspect-ratio: 16/9; }
          .aspect-square { aspect-ratio: 1/1; }

          /* Fixed heights for highlights image container */
          .h-40 { height: 10rem !important; min-height: 10rem !important; }

          /* Main content - CRITICAL: min-height prevents footer from stretching */
          /* Uses 100lvh (large viewport) - header(64px) to fill viewport */
          /* This ensures footer stays at natural size from first paint */
          main { flex: 1 0 auto; min-height: calc(100lvh - 64px); }

          /* Footer - natural height, flex-shrink:0 prevents compression */
          footer[role="contentinfo"] { flex-shrink: 0; }
        `}} />
      </head>
      <body
        suppressHydrationWarning={true}
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} ${fraunces.variable} antialiased`}
      >
        <ThemeInitializer
          defaultTheme={siteSettings.themePreset}
          defaultFont={siteSettings.fontPreset}
        />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
