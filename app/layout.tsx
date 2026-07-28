import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tradewind DealFlow | New England Wholesale OS",
    template: "%s | Tradewind DealFlow",
  },
  description:
    "A local-first 90-Day First-Deal Execution System for beginning real estate wholesalers in Massachusetts and Rhode Island.",
  applicationName: "Tradewind DealFlow",
  openGraph: {
    title: "Tradewind DealFlow | New England Wholesale OS",
    description:
      "A sober, local-first execution system for beginning wholesalers in Massachusetts and Rhode Island.",
    type: "website",
    images: [
      {
        url: "/tradewind-dealflow-social.png",
        width: 1200,
        height: 630,
        alt: "Abstract New England coastal navigation chart in the Tradewind DealFlow palette",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tradewind DealFlow | New England Wholesale OS",
    description:
      "A local-first 90-Day First-Deal Execution System with compliance guardrails.",
    images: ["/tradewind-dealflow-social.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071d2b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
