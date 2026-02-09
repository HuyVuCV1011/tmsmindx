"use client";

import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PageContainer } from "@/components/PageContainer";
import { Layers } from "lucide-react";

export default function Page4() {
  return (
    <PageContainer
      title="Màn hình 4"
      description="Nội dung và quản lý màn hình 4"
    >
      <Card>
        <EmptyState
          icon={Layers}
          title="Chưa có nội dung"
          description="Màn hình này đang được phát triển. Nội dung sẽ được cập nhật sớm."
        />
      </Card>
    </PageContainer>
  );
}
