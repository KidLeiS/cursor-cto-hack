import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ios-demo",
});

export const metadata: Metadata = {
  title: "Sushicode iOS demo",
  description: "Mobile notes and agent progress wireframe for Sushicode.",
};

export default function IosDemoLayout({ children }: { children: ReactNode }) {
  return <div className={`${inter.className} ${inter.variable}`}>{children}</div>;
}
