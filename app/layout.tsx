import { Analytics } from "@vercel/analytics/react"
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PersistentLayout } from "@/components/PersistentLayout";
import { TrackerProvider } from "@/components/TrackerProvider";
import { AuthProvider } from "@/lib/auth-context";
import { TeacherProvider } from "@/lib/teacher-context";
import StoreProvider from "./StoreProvider";
import type { Metadata } from "next";
import { Exo } from "next/font/google";
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const exo = Exo({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-exo",
});

export const metadata: Metadata = {
  title: "Teaching Portal System (TPS)",
  description: "Hệ thống quản lý giảng dạy",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kaushan+Script&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${exo.variable} font-exo bg-white text-gray-900`}>
        <ErrorBoundary>
          <StoreProvider>
            <AuthProvider>
              <TeacherProvider>
                <TrackerProvider>
                  <PersistentLayout>
                    {children}
                  </PersistentLayout>
                </TrackerProvider>
              </TeacherProvider>
            </AuthProvider>
          </StoreProvider>
        </ErrorBoundary>
        <Toaster
          position="top-right"
          containerStyle={{ top: 24, right: 24 }}
          gutter={12}
          toastOptions={{
            duration: 4000,
            style: {
              background: "transparent",
              boxShadow: "none",
              padding: 0,
              maxWidth: "none",
            },
          }}
        />
        <Analytics />
      </body>
    </html>
  );
}
