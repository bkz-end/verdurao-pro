import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConnectionErrorProvider } from "@/contexts/ConnectionErrorContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VerdurãoPro - Sistema de Gestão para Verdurões",
  description: "Sistema completo de gestão para verdurões e hortifrútis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConnectionErrorProvider toastPosition="top-center" toastDuration={5000}>
          {children}
        </ConnectionErrorProvider>
      </body>
    </html>
  );
}
