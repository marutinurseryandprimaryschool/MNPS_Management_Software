import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Maruti Nursery & Primary School — Management System',
  description: 'Maruti Nursery & Primary School - Nurturing young minds for a brighter tomorrow. Complete school management platform for students, teachers, attendance, fees, and communication.',
  keywords: 'Maruti School, nursery school, primary school, education, school management, student management, timetable, attendance, fees',
  manifest: '/manifest.webmanifest',
  applicationName: 'Maruti Nursery',
  appleWebApp: {
    capable: true,
    title: 'Maruti Nursery',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/logo.jpeg', type: 'image/jpeg' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
      { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: [{ url: '/icon-192.png', type: 'image/png', sizes: '192x192' }],
    shortcut: [{ url: '/icon-192.png', type: 'image/png' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#DC2626" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
