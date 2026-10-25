import type { Metadata } from "next";
import { IBM_Plex_Sans, Noto_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { PLATFORM } from "@/config/platform";
import "./globals.css";

// Latin text uses IBM Plex Sans; Arabic text uses Noto Sans Arabic, a plain, highly legible face.
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});
const noto = Noto_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as "en" | "ar";
  return { title: { default: PLATFORM.name[locale], template: `%s · ${PLATFORM.name[locale]}` } };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${plex.variable} ${noto.variable}`}>
      <body className="min-h-screen">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
