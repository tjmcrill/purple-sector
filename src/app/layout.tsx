import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Purple Sector",
  description: "Head-to-head qualifying lap comparisons across F1 circuits and seasons.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#0f0f0f]">
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-[#0f0f0f] text-[#f5f5f5] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
