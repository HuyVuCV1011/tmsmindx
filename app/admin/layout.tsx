"use client";

import AppLayout from "@/components/AppLayout";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout requireAuth={true} requireAdmin={true} redirectPath="/login">
      {children}
    </AppLayout>
  );
}
