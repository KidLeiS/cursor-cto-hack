import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DM_Mono, Lato } from "next/font/google";
import "@mdxeditor/editor/style.css";
import "@xyflow/react/dist/style.css";
import "./globals.css";

const body = Lato({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-body-loaded",
});

const mono = DM_Mono({
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
      <body className={`${body.className} ${body.variable} ${mono.variable}`}>
        <style>{`
          :root {
            --font-display: var(--font-body-loaded), "Lato", sans-serif;
            --font-body: var(--font-body-loaded), "Lato", sans-serif;
            --font-mono: var(--font-mono-loaded), "DM Mono", ui-monospace, monospace;
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
