# 🎨 UI Components Documentation

## Tổng quan
Hệ thống UI components được thiết kế để tạo giao diện nhất quán, đẹp và dễ bảo trì cho toàn bộ ứng dụng.

## 📦 Components

### 1. PageContainer
Wrapper chính cho mọi trang, cung cấp layout nhất quán.

```tsx
import { PageContainer } from '@/components';

<PageContainer
  title="Tiêu đề trang"
  description="Mô tả ngắn"
  maxWidth="2xl" // sm | md | lg | xl | 2xl | full
>
  {/* Nội dung trang */}
</PageContainer>
```

### 2. Card
Component card với nhiều options.

```tsx
import { Card } from '@/components';

<Card
  title="Tiêu đề card"
  padding="md" // sm | md | lg
  hover={true} // hover effect
>
  {/* Nội dung */}
</Card>
```

### 3. StatCard
Card hiển thị thống kê với icon.

```tsx
import { StatCard } from '@/components';
import { Users } from 'lucide-react';

<StatCard
  title="Tổng giáo viên"
  value="150"
  icon={Users}
  description="Đang hoạt động"
  color="red" // red | blue | green | purple | orange
  trend={{ value: "12%", isPositive: true }}
/>
```

### 4. EmptyState
Hiển thị khi không có dữ liệu.

```tsx
import { EmptyState } from '@/components';
import { Inbox } from 'lucide-react';

<EmptyState
  icon={Inbox}
  title="Không có dữ liệu"
  description="Chưa có nội dung nào được tạo"
  action={{
    label: "Tạo mới",
    onClick: () => {}
  }}
/>
```

### 5. LoadingSpinner
Spinner loading với size options.

```tsx
import { LoadingSpinner } from '@/components';

<LoadingSpinner
  size="md" // sm | md | lg
  text="Đang tải..."
/>
```

### 6. Tabs
Tabs navigation component.

```tsx
import { Tabs } from '@/components';

<Tabs
  tabs={[
    { id: 'all', label: 'Tất cả', count: 10 },
    { id: 'active', label: 'Hoạt động', count: 5 }
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
/>
```

### 7. SearchBar
Thanh tìm kiếm.

```tsx
import { SearchBar } from '@/components';

<SearchBar
  value={search}
  onChange={setSearch}
  placeholder="Tìm kiếm..."
/>
```

## 🎨 Theme Colors
- Primary: `#a1001f` → `#c41230` (gradient)
- Text: `gray-900` (dark), `gray-600` (medium), `gray-400` (light)
- Background: `white`, `gray-50`, `gray-100`

## 📱 Responsive Breakpoints
- Mobile: `< 640px`
- Tablet: `640px - 1024px`
- Desktop: `≥ 1024px`

## 🎯 Best Practices
1. Luôn dùng `PageContainer` cho mọi trang
2. Dùng `Card` để nhóm nội dung
3. Dùng `EmptyState` khi không có data
4. Dùng `LoadingSpinner` khi đang fetch data
5. Color: red cho brand, blue/green/purple cho phân biệt

## 💡 Ví dụ Complete Page

```tsx
'use client';

import { PageContainer, Card, StatCard, LoadingSpinner } from '@/components';
import { Users, FileText } from 'lucide-react';
import { useState } from 'react';

export default function MyPage() {
  const [loading, setLoading] = useState(false);

  if (loading) return <LoadingSpinner />;

  return (
    <PageContainer
      title="Dashboard"
      description="Tổng quan hệ thống"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Người dùng"
          value="150"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Bài viết"
          value="89"
          icon={FileText}
          color="green"
        />
      </div>

      <Card title="Nội dung chính">
        {/* Content here */}
      </Card>
    </PageContainer>
  );
}
```
