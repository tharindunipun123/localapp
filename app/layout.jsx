import { Inter, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { AnalyticsInit } from "@/lib/firebase/analytics";
import appConfig from "@/lib/config";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-sinhala",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Local App Sri Lanka — Events, Landmarks & Attractions",
    template: "%s | Local App Sri Lanka",
  },
  description:
    "Discover local events, landmarks, and attractions across Sri Lanka. From dansal to cultural shows — find what's happening near you.",
  metadataBase: new URL(appConfig.siteUrl),
  openGraph: {
    siteName: "Local App Sri Lanka",
    locale: "en_LK",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoSinhala.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
        <AuthProvider>
          <AnalyticsInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
