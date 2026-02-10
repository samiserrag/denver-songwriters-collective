import localFont from "next/font/local";

export const playfair = localFont({
  src: [
    { path: "../app/fonts/playfair-400.ttf", weight: "400", style: "normal" },
    { path: "../app/fonts/playfair-500.ttf", weight: "500", style: "normal" },
    { path: "../app/fonts/playfair-600.ttf", weight: "600", style: "normal" },
    { path: "../app/fonts/playfair-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-serif",
  display: "swap",
});

export const inter = localFont({
  src: [
    { path: "../app/fonts/inter-400.ttf", weight: "400", style: "normal" },
    { path: "../app/fonts/inter-500.ttf", weight: "500", style: "normal" },
    { path: "../app/fonts/inter-600.ttf", weight: "600", style: "normal" },
    { path: "../app/fonts/inter-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const fontVariables = `${playfair.variable} ${inter.variable}`;
