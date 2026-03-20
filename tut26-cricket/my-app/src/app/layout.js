import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "./components/SmoothScroll";
import RouteFeedbackProvider from "./components/shared/RouteFeedbackProvider";
import { Analytics } from "@vercel/analytics/next";
import { absoluteUrl, getSiteUrl, siteConfig } from "./lib/site-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL(getSiteUrl()),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.defaultTitle,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  manifest: "/manifest.json",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  icons: {
    icon: "/gvLogo.png",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    siteName: siteConfig.name,
    title: siteConfig.ogTitle,
    description: siteConfig.description,
    images: [
      {
        url: absoluteUrl(siteConfig.ogImagePath),
        width: 1200,
        height: 630,
        alt: "GV Cricket app preview with live score, umpire mode, and director controls",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.ogTitle,
    description: siteConfig.description,
    images: [
      {
        url: absoluteUrl(siteConfig.twitterImagePath),
        alt: "GV Cricket social preview",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
};

export const viewport = {
  themeColor: "#050507",
  colorScheme: "dark",
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: getSiteUrl(),
    description: siteConfig.description,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "SportsApplication",
    operatingSystem: "Any",
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description: siteConfig.description,
    url: getSiteUrl(),
    image: absoluteUrl(siteConfig.ogImagePath),
    featureList: [
      "Live score updates",
      "Umpire mode",
      "Spectator live view",
      "Director controls",
      "Score announcer and loudspeaker",
      "Walkie-talkie",
      "Match image uploads",
      "Match stats and results",
    ],
  },
];

export default function RootLayout({ children }) {
  const shouldRenderAnalytics =
    process.env.NODE_ENV === "production" &&
    process.env.VERCEL === "1" &&
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "1";

  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
      >
        <RouteFeedbackProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </RouteFeedbackProvider>
        {shouldRenderAnalytics ? <Analytics /> : null}
      </body>
    </html>
  );
}
