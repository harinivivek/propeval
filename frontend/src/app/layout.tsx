import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropEval - Property Valuation Marketplace",
  description: "Property Valuation & Legal Reports Marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
