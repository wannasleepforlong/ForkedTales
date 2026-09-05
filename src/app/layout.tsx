import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ForkedTales — branching visual-novel stories",
    template: "%s · ForkedTales",
  },
  description:
    "Read and write branching, visual-novel-style interactive stories. Every choice matters — every ending is yours to find.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <div className="flex-1">{children}</div>
          <footer className="mt-16 border-t border-white/5 py-8 text-center text-xs text-parchment/40">
            ForkedTales · a home for branching stories
          </footer>
        </div>
      </body>
    </html>
  );
}
