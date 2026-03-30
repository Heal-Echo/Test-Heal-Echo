import localFont from "next/font/local";

export const notoSans = localFont({
  src: [
    { path: "./fonts/NotoSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/NotoSans-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/NotoSans-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "./fonts/NotoSans-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-noto",
  display: "swap",
});

export const playfair = localFont({
  src: [
    { path: "./fonts/PlayfairDisplay-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/PlayfairDisplay-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-playfair",
  display: "swap",
});
