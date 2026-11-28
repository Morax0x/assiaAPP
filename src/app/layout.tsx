import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic, Montserrat, Noto_Kufi_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/layout/sw-register";
import { ErrorReporter } from "@/components/layout/error-reporter";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

// Stand-ins for the invoice fonts until Droid Arabic Kufi / Garet files are placed in public/fonts
const kufi = Noto_Kufi_Arabic({ subsets: ["arabic"], weight: ["400", "700"], variable: "--font-noto-kufi", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["700"], variable: "--font-montserrat", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL((process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")),
  title: { default: "آسيا لخدمات رجال الأعمال", template: "%s | آسيا" },
  description: "إدارة المكتب من مكان واحد.",
  openGraph: {
    type: "website", locale: "ar_AE", siteName: "آسيا لخدمات رجال الأعمال",
    title: "آسيا لخدمات رجال الأعمال",
    description: "إدارة المكتب من مكان واحد.",
    images: [{ url: "/logo.png", width: 600, height: 625, alt: "آسيا" }],
  },
  applicationName: "آسيا",
  appleWebApp: { capable: true, title: "آسيا", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#204f89",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${plex.variable} ${kufi.variable} ${montserrat.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'light';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.dataset.theme=d?'dark':'light';h.dataset.fs=localStorage.getItem('fs')||'md'}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster position="top-center" dir="rtl" toastOptions={{ classNames: { toast: "!bg-surface !text-ink !border-line !font-sans !text-[15px]" } }} />
        <SwRegister />
        <ErrorReporter />
      </body>
    </html>
  );
}
