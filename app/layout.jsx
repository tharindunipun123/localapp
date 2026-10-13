import { Plus_Jakarta_Sans, Noto_Sans_Sinhala } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { AnalyticsInit } from "@/lib/firebase/analytics";
import { AppPreloader } from "@/components/layout/AppPreloader";
import { RouteProgress } from "@/components/layout/RouteProgress";
import appConfig from "@/lib/config";

const PRELOADER_BOOT = `(function(){try{if(sessionStorage.getItem("la_ready")==="1"){document.documentElement.classList.add("app-booted");}}catch(e){}function boot(){document.documentElement.classList.add("app-booted");try{sessionStorage.setItem("la_ready","1");}catch(e){}}if(document.readyState==="complete"){boot();}else{window.addEventListener("DOMContentLoaded",boot,{once:true});window.addEventListener("load",boot,{once:true});}setTimeout(boot,800);})();`;

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const notoSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-noto-sinhala",
  display: "swap",
});

export const metadata = {
  title: {
    default: "Local App Sri Lanka — Wallet, Events & Identity",
    template: "%s | Local App Sri Lanka",
  },
  description:
    "Institutional wallet, KYC, vendor loyalty, and event rails for Sri Lanka.",
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
      className={`${jakarta.variable} ${notoSinhala.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://firebase.googleapis.com" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--color-bg)] text-[var(--color-fg)] font-sans">
        <div id="app-preloader" className="app-preloader" role="status" aria-live="polite" aria-label="Loading Local App">
          <div className="app-preloader-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-icon.png" alt="" width={56} height={56} />
            <div className="app-preloader-bar" aria-hidden="true">
              <span />
            </div>
            <p>Local App Sri Lanka</p>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: PRELOADER_BOOT }} />
        <AuthProvider>
          <AppPreloader />
          <RouteProgress />
          <AnalyticsInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
