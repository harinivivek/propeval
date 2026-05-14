import type { Metadata } from "next";
import { SonnerProvider } from "@/components/sonner-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropEval",
  description: "Property valuation and legal reports marketplace",
  manifest: "/manifest.json",
  themeColor: "#2563eb",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PropEval",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        <SonnerProvider />
      </body>
    </html>
  );
}
