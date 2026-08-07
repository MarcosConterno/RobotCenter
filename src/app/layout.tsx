import "./globals.css";
import type { Metadata } from "next";
import { AdminAccessProvider } from "@/auth/AdminAccessProvider";
import { AppDataProvider } from "@/data/AppDataProvider";
import ThemeProvider from "@/components/theme/ThemeProvider";

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
          <AdminAccessProvider><AppDataProvider>{children}</AppDataProvider></AdminAccessProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
