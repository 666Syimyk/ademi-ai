import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const themeBootScript = `(function(){try{var m=localStorage.getItem("ademi-theme")||"dark";var d=m==="light"?"light":m==="system"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=d;document.documentElement.dataset.themeMode=m;document.documentElement.style.colorScheme=d}catch(e){}})()`;

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og-black-gold.png`;
  const title = "ADEMI MIND — психологический AI-собеседник";
  const description = "Бережный AI-собеседник о психологии, отношениях и внутренней опоре на русском, кыргызском и английском языках.";

  return {
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: image, width: 1731, height: 909 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0b0c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
