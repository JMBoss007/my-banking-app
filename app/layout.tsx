export const dynamic = 'force-dynamic'

import type { Metadata } from "next";
import { Inter, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ['latin'],
  weight: ['400', '700']
});

export const metadata: Metadata = {
  title: "Horizon",
  description: "Horizon is a modern banking platform for everyone.",
  icons: { icon: '/icons/logo.svg' }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} ${ibmPlexSerif.className}`}>
        {children}
      </body>
    </html>
  );
}
