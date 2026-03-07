import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PDF UI Prototype',
  description: 'PDF annotation and category summary prototype'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
