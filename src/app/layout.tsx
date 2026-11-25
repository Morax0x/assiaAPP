import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Toaster } from "sonner";
import { SwRegister } from "@/components/layout/sw-register";
import "./globals.css";

const plex = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "آسيا لخدمات رجال الأعمال", template: "%s | آسيا" },
  description: "نظام إدارة المعاملات والخزينة والمستندات",
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
    <html lang="ar" dir="rtl" className={plex.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;h.dataset.theme=d?'dark':'light';h.dataset.fs=localStorage.getItem('fs')||'md'}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Toaster position="top-center" dir="rtl" toastOptions={{ classNames: { toast: "!bg-surface !text-ink !border-line !font-sans !text-[15px]" } }} />
        <SwRegister />
      </body>
    </html>
  );
}
