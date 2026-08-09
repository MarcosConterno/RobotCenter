import "./globals.css";
import "driver.js/dist/driver.css";
import type { Metadata } from "next";
import { AdminAccessProvider } from "@/auth/AdminAccessProvider";
import { AppDataProvider } from "@/data/AppDataProvider";
import { FlowsDataProvider } from "@/data/FlowsDataProvider";
import ThemeProvider from "@/components/theme/ThemeProvider";
import { TutorialProvider } from "@/tutorial/TutorialProvider";

export const metadata: Metadata = {
  title: "Robot Center",
  description: "Painel Robot Center",
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
