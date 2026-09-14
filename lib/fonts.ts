import { Inter, Inter_Tight, Ms_Madi } from "next/font/google";

/**
 * PRD §5.3 — self-hosted through next/font (no layout shift, no third-party
 * font requests). Latin subset only, per the §12 performance budget.
 */
export const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-inter-tight",
  display: "swap",
});

export const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Fallback for the handwritten greeting. The preferred route is SVG lettering
 * uploaded in admin (PRD §5.3, HERO-02); this face renders the text mode.
 */
export const greeting = Ms_Madi({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-greeting",
  display: "swap",
});

export const fontVariables = `${interTight.variable} ${inter.variable} ${greeting.variable}`;
