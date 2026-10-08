import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import Toaster from "@/components/Toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
});

const description =
  "Set the dress code, share one link, and see what everyone's wearing before anyone shows up in the same outfit.";

export const metadata: Metadata = {
  // Needed so link-preview images resolve to absolute URLs.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://what-are-we-wearing-nu.vercel.app"),
  title: {
    default: "What Are We Wearing?",
    template: "%s · What Are We Wearing?",
  },
  description,
  openGraph: {
    title: "What Are We Wearing?",
    description,
    siteName: "What Are We Wearing?",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cream text-stone">
        <SiteHeader />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
