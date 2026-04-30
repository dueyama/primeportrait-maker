import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrimePortrait Maker",
  description: "Turn an uploaded image into a digit portrait whose full decimal string passes probable-prime tests.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
