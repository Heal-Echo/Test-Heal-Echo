import "./globals.css";
import { notoSans, playfair } from "./fonts";
import type { Viewport } from "next";

export const metadata = {
  title: "Heal Echo",
  description: "Heal Echo Web Application",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ko"
      className={`${notoSans.variable} ${playfair.variable}`}
    >
      <body className="font-noto">{children}</body>
    </html>
  );
}
