import { Sidebar } from "@/components/sidebar";
import type { Metadata } from "next";
import { Exo } from "next/font/google";
import "./globals.css";

const exo = Exo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-exo",
});

export const metadata: Metadata = {
  title: "Teaching Management System",
  description: "Hệ thống quản lý giảng dạy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${exo.variable} font-exo bg-white text-gray-900`}>
        <div className="relative min-h-screen bg-white">
          <Sidebar />
          <main className="transition-all duration-300 ease-in-out lg:pl-48">
            <div className="p-4 pt-12 lg:pt-4">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
