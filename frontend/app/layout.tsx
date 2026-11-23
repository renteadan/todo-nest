import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

// Variable width axis: `.display` uses the condensed cut for titles.
const bricolage = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
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
      className={`${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
