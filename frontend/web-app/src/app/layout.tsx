import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Xccelera Platform',
    template: '%s | Xccelera Platform',
  },
  description:
    'AI-Driven SDLC Platform — Automate your entire software development lifecycle with 8 AI engines and 13 intelligent microservices.',
  keywords: [
    'AI',
    'SDLC',
    'Software Development',
    'Project Management',
    'Automation',
    'Xccelera',
  ],
  authors: [{ name: 'Xccelera', url: 'https://xccelera.ai' }],
  creator: 'Xccelera',
  themeColor: '#0a0f1e',
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'Xccelera Platform',
    description: 'AI-Driven SDLC Platform',
    siteName: 'Xccelera',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#0a0f1e] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
