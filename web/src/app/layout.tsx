import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Denver Songwriters Collective",
    template: "%s | Denver Songwriters Collective",
  },
  description: "Find your people. Find your stage. Find your songs. Denver's community hub for songwriters, open mics, showcases, and collaboration.",
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
