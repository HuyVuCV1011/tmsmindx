# Button Consistency Audit & Migration Plan

## Vấn đề hiện tại

Ứng dụng có **nhiều button với styling không nhất quán**:
- Màu sắc khác nhau (blue, red, gray, etc.)
- Font weight khác nhau (font-semibold, font-bold)
- Padding khác nhau (py-2, py-3, px-3, px-4)
- Border radius khác nhau (rounded-lg, rounded-xl, rounded-full)
- Hover effects khác nhau

## ✅ Đã hoàn thành

### 1. Sidebar Buttons (✅ Completed)
- **File**: `components/sidebar.tsx`
- **Button**: "Đăng xuất"
- **Status**: ✅ Đã migrate sang `Button` component với `variant="outline"`

### 2. Slider Sidebar Buttons (✅ Completed)
- **File**: `components/slider-sidebar.tsx`
- **Button**: "Xem tất cả bài viết"
- **Status**: ✅ Đã migrate sang `Button` component với `variant="outline"`

### 3. Upcoming Events Sidebar (✅ Just Completed)
- **File**: `components/upcoming-events-sidebar.tsx`
- **Buttons**:
  - ✅ "Xem toàn bộ lịch" - Đã migrate sang `Button variant="outline"`
  - ✅ "Gửi lời chúc ngay" - Đã migrate sang `Button variant="outline"` với custom styling cho theme đỏ

## 🔄 Cần migrate

### Priority 1: Navigation & Action Buttons

#### A. Slider Component
- **File**: `components/slider.tsx`
- **Lines**: 164, 167
- **Buttons**: Previous/Next arrows
- **Current**: Inline styles với `rounded-full`, `bg-black/30`
- **Recommendation**: Tạo `Button variant="ghost" size="icon"` hoặc custom variant cho carousel controls

#### B. User Profile Page
- **File**: `app/user/profile/page.tsx`
- **Line**: 358
- **Button**: Upload avatar button
- **Current**: `rounded-full`, `bg-white`, `text-blue-600`
- **Recommendation**: `Button variant="outline" size="icon"` với custom styling

#### C. Assignments Page
- **File**: `app/user/assignments/page.tsx`
- **Line**: 2581
- **Button**: Expand/collapse button
- **Current**: `rounded-full`, `text-gray-400`, hover effects
- **Recommendation**: `Button variant="ghost" size="icon"`

### Priority 2: Modal & Dialog Buttons

#### D. Admin User Management
- **File**: `app/admin/user-management/components/UsersTab.tsx`
- **Multiple buttons**:
  - Line 588, 634, 682, 727, 808, 856: Close buttons (X icon)
  - Line 618, 666, 708, 789, 844, 870: Cancel buttons
  - Line 620: "Thêm & Phân quyền" button
  - Line 668: "Tạo tài khoản" button
  - Line 710-711: "Gán role" button
  - Line 791-792: "Gán cơ sở" button
  - Line 872: "Cập nhật MK" button

**Recommendations**:
- Close buttons: `Button variant="ghost" size="icon-sm"`
- Cancel buttons: `Button variant="outline"`
- Primary action buttons: `Button variant="default"` hoặc `variant="mindx"`
- Destructive actions: `Button variant="destructive"`

#### E. Birthday Send Wish Popup
- **File**: `components/birthday-send-wish-popup.tsx`
- **Lines**: 242, 314
- **Buttons**: Close button, Submit button
- **Current**: Custom styling với `rounded-xl`, `bg-white`, `text-[#8d1425]`
- **Recommendation**: 
  - Close: `Button variant="ghost" size="icon"`
  - Submit: `Button variant="default"` với custom color scheme

#### F. HR Candidates Drawer
- **File**: `app/admin/hr-candidates/components/CandidateDetailDrawer.tsx`
- **Line**: 23
- **Button**: Close button
- **Recommendation**: `Button variant="ghost" size="icon"`

### Priority 3: Specialized Buttons

#### G. TruyenThong Post Detail
- **File**: `components/TruyenThongPostDetailView.tsx`
- **Lines**: 380, 455
- **Buttons**: Copy link, Share buttons
- **Current**: Custom styling với brand colors
- **Recommendation**: `Button variant="outline"` với custom brand styling

#### H. Exam Recovery HUD
- **File**: `components/ExamRegImportRecoveryHud.tsx`
- **Line**: 98
- **Button**: Dismiss button
- **Current**: `rounded`, `border-amber-300`, `bg-white`
- **Recommendation**: `Button variant="outline" size="xs"`

#### I. Onboarding Component
- **File**: `components/onboarding/UserFirstLoginOnboarding.tsx`
- **Lines**: 592, 600
- **Buttons**: Previous/Next navigation
- **Current**: Custom styling với brand colors
- **Recommendation**: 
  - Previous: `Button variant="outline"`
  - Next: `Button variant="mindx"`

## Migration Strategy

### Step 1: Import Button Component
```tsx
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
```

### Step 2: Replace inline button với Button component

**Before:**
```tsx
<button
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  onClick={handleClick}
>
  Click me
</button>
```

**After:**
```tsx
<Button variant="default" onClick={handleClick}>
  Click me
</Button>
```

### Step 3: Sử dụng asChild cho Link buttons

**Before:**
```tsx
<Link
  href="/path"
  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
>
  <span>View all</span>
  <ArrowRight className="w-4 h-4" />
</Link>
```

**After:**
```tsx
<Button variant="outline" asChild>
  <Link href="/path">
    View all
    <Icon icon={ArrowRight} size="sm" />
  </Link>
</Button>
```

### Step 4: Custom styling khi cần thiết

Đối với buttons cần styling đặc biệt (như theme đỏ trong birthday section):
```tsx
<Button
  variant="outline"
  className="bg-white/15 hover:bg-white text-white hover:text-red-700 border-white/30"
>
  Custom styled button
</Button>
```

## Button Variants Reference

### Available Variants:
1. **default** - Primary action (blue/brand color)
2. **secondary** - Secondary action (gray tonal)
3. **outline** - Tertiary action (bordered)
4. **ghost** - Low emphasis (no border/background)
5. **destructive** - Dangerous actions (red)
6. **link** - Text link style
7. **success** - Positive actions (green)
8. **mindx** - Brand gradient (red gradient)

### Available Sizes:
1. **xs** - Extra small (h-7, text-xs)
2. **sm** - Small (h-8, text-sm)
3. **default** - Medium (h-9, text-sm)
4. **lg** - Large (h-10, text-base)
5. **xl** - Extra large (h-11, text-base)
6. **icon** - Icon only (size-9)
7. **icon-sm** - Small icon (size-8)
8. **icon-lg** - Large icon (size-10)

## Benefits of Consistency

1. **Maintainability**: Một nơi để update styling
2. **Accessibility**: Built-in focus states, ARIA attributes
3. **Performance**: Reusable component, smaller bundle
4. **UX**: Consistent interaction patterns
5. **Developer Experience**: Easier to use, less code to write

## Next Steps

1. ✅ Complete Priority 1 buttons (navigation & actions)
2. ⏳ Complete Priority 2 buttons (modals & dialogs)
3. ⏳ Complete Priority 3 buttons (specialized)
4. ⏳ Create custom variants if needed (e.g., `carousel-control`, `birthday-theme`)
5. ⏳ Update documentation with examples
6. ⏳ Run visual regression tests

## Notes

- Không cần migrate tất cả buttons cùng lúc
- Ưu tiên các buttons được sử dụng nhiều nhất
- Giữ lại custom styling khi cần thiết cho brand identity
- Test thoroughly sau mỗi migration
