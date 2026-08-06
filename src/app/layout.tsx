import "./globals.css";
import type { Metadata } from "next";
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
      <body><AppDataProvider>{children}</AppDataProvider></body>
    </html>
  );
}
