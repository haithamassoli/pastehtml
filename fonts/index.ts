import localFont from "next/font/local";

export const thmanyahSans = localFont({
  src: [
    {
      path: "./thmanyahsans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./thmanyahsans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./thmanyahsans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./thmanyahsans-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./thmanyahsans-Black.woff2",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});
