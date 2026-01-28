"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { FileText } from "lucide-react";

export default function Page2() {
  return (
    <PageContainer
      title="Màn hình 2"
      description="Nội dung và quản lý màn hình 2"
    >
      <Card>
        <EmptyState
          icon={FileText}
          title="Chưa có nội dung"
          description="Màn hình này đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}
