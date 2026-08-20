import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Brightspace CSV Converter',
  description: 'Convert evaluation text and Word documents into Brightspace compatible CSV format.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
