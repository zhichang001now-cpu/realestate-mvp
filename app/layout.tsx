import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealtyIQ",
  description: "不動産投資決策システム",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  );
}
