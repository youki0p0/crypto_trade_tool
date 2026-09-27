import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "Crypto Trade Sim — デモトレード＆税金シミュレーション",
  description:
    "実資金を使わずに暗号通貨取引を練習・検証し、日本の税制を考慮した手取り利益をシミュレーションできるツール。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className="min-h-screen bg-background antialiased">
        <Navbar />
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
