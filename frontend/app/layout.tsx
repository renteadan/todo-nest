import type { Metadata } from 'next';
import { Hanken_Grotesk } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

// Body face; Sentient (below) sets the titles.
const hanken = Hanken_Grotesk({
  variable: '--font-hanken',
  subsets: ['latin'],
  weight: ['400', '500'],
});

// Self-hosted from Fontshare (ITF Free Font License).
const sentient = localFont({
  variable: '--font-sentient',
  src: [
    { path: './fonts/sentient-300.woff2', weight: '300' },
    { path: './fonts/sentient-400.woff2', weight: '400' },
  ],
  fallback: ['Georgia', 'serif'],
});

export const metadata: Metadata = {
  title: 'Todo',
  description: 'A simple todo app',
};

// Applies the theme pinned by the navbar switch (theme-switch.tsx) before first paint.
const themeScript = `try{var t=localStorage.theme;if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The script sets data-theme on <html> before React hydrates.
    <html
      lang="en"
      className={`${hanken.variable} ${sentient.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
