import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CampusOS — School Management System',
  description: 'Complete school management platform with student management, timetable scheduling, attendance tracking, fee management, and parent-teacher communication.',
  keywords: 'school management, student management, timetable, attendance, fees, education, SaaS',
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
        <meta name="theme-color" content="#4F46E5" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
