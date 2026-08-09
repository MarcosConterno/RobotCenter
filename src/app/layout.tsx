import "./globals.css";
import "driver.js/dist/driver.css";
import type { Metadata } from "next";
import { AdminAccessProvider } from "@/auth/AdminAccessProvider";
import { AppDataProvider } from "@/data/AppDataProvider";
import { FlowsDataProvider } from "@/data/FlowsDataProvider";
import ThemeProvider from "@/components/theme/ThemeProvider";
import { TutorialProvider } from "@/tutorial/TutorialProvider";

const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  applicationName: "Robot Center",
  title: {
    default: "Robot Center",
    template: "%s | Robot Center",
  },
  description: "Centralize robôs, fluxos, documentações e atualizações operacionais em um único workspace.",
  icons: {
    icon: [{ url: "/images/robot-center-system-logo-transparent.png", type: "image/png" }],
    shortcut: "/images/robot-center-system-logo-transparent.png",
    apple: "/images/robot-center-system-logo-transparent.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Robot Center",
    title: "Robot Center — Automações em um só lugar",
    description: "Acompanhe robôs, fluxos, documentações e as atualizações mais recentes da operação.",
    images: [{
      url: "/images/robot-center-system-logo-transparent.png",
      alt: "Logo do Robot Center",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Robot Center — Automações em um só lugar",
    description: "Acompanhe robôs, fluxos, documentações e as atualizações mais recentes da operação.",
    images: ["/images/robot-center-system-logo-transparent.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AdminAccessProvider><TutorialProvider><AppDataProvider><FlowsDataProvider>{children}</FlowsDataProvider></AppDataProvider></TutorialProvider></AdminAccessProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
