import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RealtyIQ',
  description: '日本不動産ファンド向け AI 投資判断ツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
