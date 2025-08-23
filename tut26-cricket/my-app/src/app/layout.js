// src/app/layout.jsx
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SmoothScroll from "./components/SmoothScroll"; // Assuming this component exists
import { Analytics } from "@vercel/analytics/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Define your site's main information
const siteName = "GV Cricket";
const siteDescription =
  "Free live cricket scoring app. Track ball-by-ball scores, manage teams, and get real-time updates for any match.";
const siteUrl = "https://gvcricket.com/"; // As requested
const gvLogoPath = "/gvLogo.png"; // Path to your logo in the public directory, as per your file structure

export const metadata = {
  metadataBase: new URL(siteUrl),

  // Basic SEO metadata
  title: {
    default: siteName,
    template: `%s | ${siteName}`, // Title for other pages will be "Page Title | GV Cricket"
  },
  description: siteDescription,
  keywords: [
    "cricket",
    "score",
    "live scores",
    "cricket app",
    "score keeper",
    "match tracking",
    "team management",
    "cricket stats",
    "umpire tool",
    "sports scoring",
    "online cricket",
    "gully cricket app",
    "local cricket scorer",
    "cricket scoring sheet online",
    "live cricket score tracker",
    "Indian cricket app",
    "free cricket scoring app",
    "ball by ball scoring",
    "cricket scorer for India",
    "Pakistan cricket scoring app",
    "Australia cricket scores",
    "England cricket live score",
    "South Africa cricket app",
    "New Zealand cricket tracker",
    "Sri Lanka cricket scores",
    "Bangladesh cricket live app",
    "West Indies cricket scoring",
    "tennis ball cricket scorer",
    "box cricket score keeper",
    "cricket tournament manager",
    "live match scoring app",
    "mobile cricket scoring",
    "digital cricket scorecard",
    "simple cricket scoring app",
    "online cricket scorebook",
    "cricket score calculator",
    "best cricket scoring app",
    "cricket club management app",
    "local league cricket scoring",
    "cricket score app for android",
    "cricket score app for iOS",
    "cricket stats tracker",
    "player performance tracker cricket",
    "cricket over tracker",
    "run rate calculator cricket",
    "free score keeping app",
    "cricket score keeper online free",
    "gully cricket score app India",
  ],
  authors: [{ name: "GV Cricket Team", url: siteUrl }],
  creator: "GV Cricket Team",
  publisher: "GV Cricket Innovations",
  applicationName: siteName,
  category: "Sports",

  // Link to the manifest file for PWA capabilities
  manifest: "/manifest.json",

  // Favicons (ensure these files are in your /public directory)
  icons: {
    icon: "/gvLogo.png", // Standard favicon
    shortcut: "/gvLogo.png", // Optional: 16x16 for shortcuts
    apple: "/gvLogo.png", // Optional: Apple touch icon for iOS devices
  },

  // Open Graph (for social media sharing previews like Facebook, LinkedIn, WhatsApp)
  openGraph: {
    title: siteName,
    description: siteDescription,
    url: siteUrl,
    siteName: siteName,
    images: [
      {
        url: gvLogoPath, // Using gvLogo.png as the main social image
        width: 1200, // Recommended width for Open Graph images
        height: 630, // Recommended height for Open Graph images
        alt: `${siteName} Logo`,
      },
      // You can add more image objects if you have different dimensions or variations
    ],
    locale: "en_US",
    type: "website", // This indicates it's a general website
  },

  // Twitter Card (for Twitter sharing previews)
  twitter: {
    card: "/gvLogo.png", // Displays a large image at the top of the tweet
    title: siteName,
    description: siteDescription,
    creator: "@GVCricketApp", // Placeholder: Replace with your actual Twitter handle if you have one
    images: [gvLogoPath], // Using gvLogo.png for Twitter card image
  },

  // Robots meta tag for search engine crawling behavior
  robots: {
    index: true, // Allows search engines to index the page
    follow: true, // Allows search engines to follow links from the page
    nocache: false, // Indicates that search engines should not use a cached version of the page
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false, // Allows Googlebot to index images
      "max-video-preview": -1, // No limit on video preview duration
      "max-snippet": -1, // No limit on text snippet length
    },
  },

  // Canonical URL (optional, helps search engines understand the preferred URL for content)
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport = {
  themeColor: "#000000",
};

// JSON-LD Structured Data for Rich Snippets
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "GV Cricket",
  operatingSystem: "WEB",
  applicationCategory: "SportsApplication",
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "120",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description: siteDescription,
  url: siteUrl,
  logo: `${siteUrl}${gvLogoPath}`,
};

export default function RootLayout({ children }) {
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
        <SmoothScroll>{children}</SmoothScroll>
        <Analytics />
      </body>
    </html>
  );
}
