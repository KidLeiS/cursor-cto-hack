import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "@mdxeditor/editor/style.css";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display-loaded",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body-loaded",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "Sushicode — Spatial development workspace",
  description: "Plan projects spatially and coordinate agent execution.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        <style>{`
          :root {
            --font-display: var(--font-display-loaded), "Times New Roman", serif;
            --font-body: var(--font-body-loaded), "Helvetica Neue", sans-serif;
            --font-mono: var(--font-mono-loaded), ui-monospace, monospace;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
