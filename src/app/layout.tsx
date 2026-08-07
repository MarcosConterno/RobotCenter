import "./globals.css";
import type { Metadata } from "next";
import { AdminAccessProvider } from "@/auth/AdminAccessProvider";
import { AppDataProvider } from "@/data/AppDataProvider";

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
    <html lang="pt-BR">
      <body><AdminAccessProvider><AppDataProvider>{children}</AppDataProvider></AdminAccessProvider></body>
    </html>
  );
}
