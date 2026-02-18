import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Header, Footer, ShareSiteCtaBar } from "@/components/navigation";
import { Toaster } from "sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ScrollReset } from "@/components/layout/ScrollReset";
import { getSiteSettings } from "@/lib/site-settings";
import { DEFAULT_SHARE_IMAGE, selectShareImageUrl } from "@/lib/share-image";
import { ThemeInitializer } from "@/components/ui/ThemeInitializer";
import "./globals.css";

const geistSans = localFont({
  variable: "--font-geist-sans",
  src: [
    { path: "./fonts/geist-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [
    { path: "./fonts/geist-mono-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist-mono-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist-mono-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const playfair = localFont({
  variable: "--font-playfair",
  src: [
    { path: "./fonts/playfair-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/playfair-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/playfair-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/playfair-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const inter = localFont({
  variable: "--font-inter",
  src: [
    { path: "./fonts/inter-300.ttf", weight: "300", style: "normal" },
    { path: "./fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/inter-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/inter-700.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
});

const fraunces = localFont({
  variable: "--font-fraunces",
  src: [
    { path: "./fonts/fraunces-400.ttf", weight: "400", style: "normal" },
    { path: "./fonts/fraunces-500.ttf", weight: "500", style: "normal" },
    { path: "./fonts/fraunces-600.ttf", weight: "600", style: "normal" },
    { path: "./fonts/fraunces-700.ttf", weight: "700", style: "normal" },
    { path: "./fonts/fraunces-800.ttf", weight: "800", style: "normal" },
    { path: "./fonts/fraunces-900.ttf", weight: "900", style: "normal" },
  ],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://denver-songwriters-collective.vercel.app";

function normalizeShareImageUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SHARE_IMAGE;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function addCacheBust(imageUrl: string, version?: string): string {
  if (!version) return imageUrl;
  try {
    const absolute = /^https?:\/\//i.test(imageUrl)
      ? new URL(imageUrl)
      : new URL(imageUrl, siteUrl);
    absolute.searchParams.set("v", version);
    return /^https?:\/\//i.test(imageUrl)
      ? absolute.toString()
      : `${absolute.pathname}${absolute.search}`;
  } catch {
    return imageUrl;
  }
}

export const viewport: Viewport = {
  themeColor: "#d4a853",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export async function generateMetadata(): Promise<Metadata> {
  const siteSettings = await getSiteSettings();
  const shareImageSource = selectShareImageUrl({
    socialShareImageUrl: siteSettings.socialShareImageUrl,
    heroImageUrl: siteSettings.heroImageUrl,
    defaultImage: DEFAULT_SHARE_IMAGE,
  });
  const shareImage = addCacheBust(
    normalizeShareImageUrl(shareImageSource),
    siteSettings.updatedAt
  );

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: "The Colorado Songwriters Collective",
      template: "%s | The Colorado Songwriters Collective",
    },
    description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "CSC",
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
    authors: [{ name: "The Colorado Songwriters Collective" }],
    creator: "The Colorado Songwriters Collective",
    openGraph: {
      type: "website",
      locale: "en_US",
      url: siteUrl,
      siteName: "The Colorado Songwriters Collective",
      title: "The Colorado Songwriters Collective",
      description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
      images: [
        {
          url: shareImage,
          alt: "The Colorado Songwriters Collective - Find your people. Find your stage. Find your songs.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "The Colorado Songwriters Collective",
      description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
      images: [shareImage],
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
}

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
            __html: `(function(){try{var t=localStorage.getItem("dsc-theme");if(t&&t!=="auto")document.documentElement.setAttribute("data-theme",t);else if(t==="auto")document.documentElement.removeAttribute("data-theme")}catch(e){}})();`,
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
        <ScrollReset />
        <ThemeInitializer
          defaultTheme={siteSettings.themePreset}
          defaultFont={siteSettings.fontPreset}
        />
        <Header socialLinks={siteSettings.socialLinks} />
        <ShareSiteCtaBar position="top" />
        <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
        <ShareSiteCtaBar position="bottom" />
        <Footer socialLinks={siteSettings.socialLinks} />
        <Toaster />
        <SpeedInsights />
      </body>
    </html>
  );
}
