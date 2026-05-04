# Button Migration Quick Guide

## 📊 Current Status

- **Total files with issues**: 74
- **Total buttons to migrate**: 212
- **High priority files**: 8 (5+ buttons each)
- **Medium priority files**: 40 (2-4 buttons each)
- **Low priority files**: 26 (1 button each)

## 🎯 Migration Priority

### Phase 1: High Priority (8 files, ~70 buttons)
1. ✅ `components/upcoming-events-sidebar.tsx` - COMPLETED
2. `app/admin/user-management/components/UsersTab.tsx` - 17 buttons
3. `app/admin/page4/thu-vien-de/page.tsx` - 13 buttons
4. `app/admin/page4/thu-vien-de/subjects/[subjectId]/page.tsx` - 8 buttons
5. `app/user/assignments/page.tsx` - 7 buttons (already has Button import!)
6. `app/public/training-detail/[code]/page.tsx` - 6 buttons
7. `app/admin/page4/lich-danh-gia/page.tsx` - 5 buttons
8. `app/admin/page4/quan-ly-lich-lam-viec/page.tsx` - 5 buttons

### Phase 2: Medium Priority (40 files, ~120 buttons)
Focus on frequently used components first:
- Modal/Dialog components
- Form components
- Navigation components

### Phase 3: Low Priority (26 files, ~26 buttons)
Can be done gradually during regular maintenance

## 🚀 Quick Migration Patterns

### Pattern 1: Simple Button
```tsx
// BEFORE
<button
  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
  onClick={handleClick}
>
  Save
</button>

// AFTER
<Button variant="default" onClick={handleClick}>
  Save
</Button>
```

### Pattern 2: Outline Button
```tsx
// BEFORE
<button
  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
  onClick={handleClick}
>
  Cancel
</button>

// AFTER
<Button variant="outline" onClick={handleClick}>
  Cancel
</Button>
```

### Pattern 3: Icon Button
```tsx
// BEFORE
<button
  className="p-2 rounded-full hover:bg-gray-100"
  onClick={handleClose}
>
  <X className="w-5 h-5" />
</button>

// AFTER
<Button variant="ghost" size="icon" onClick={handleClose}>
  <Icon icon={X} size="md" />
</Button>
```

### Pattern 4: Link as Button
```tsx
// BEFORE
<Link
  href="/path"
  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
>
  View all
  <ArrowRight className="w-4 h-4" />
</Link>

// AFTER
<Button variant="outline" asChild>
  <Link href="/path">
    View all
    <Icon icon={ArrowRight} size="sm" />
  </Link>
</Button>
```

### Pattern 5: Destructive Button
```tsx
// BEFORE
<button
  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
  onClick={handleDelete}
>
  Delete
</button>

// AFTER
<Button variant="destructive" onClick={handleDelete}>
  Delete
</Button>
```

### Pattern 6: Loading Button
```tsx
// BEFORE
<button
  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
  disabled={loading}
>
  {loading ? 'Loading...' : 'Submit'}
</button>

// AFTER
<Button variant="default" loading={loading}>
  Submit
</Button>
```

### Pattern 7: Custom Styled Button (when needed)
```tsx
// BEFORE
<button
  className="px-4 py-2 bg-gradient-to-r from-red-900 to-red-700 text-white rounded-xl"
  onClick={handleClick}
>
  Special Action
</button>

// AFTER
<Button
  variant="outline"
  className="bg-gradient-to-r from-red-900 to-red-700 text-white border-0"
  onClick={handleClick}
>
  Special Action
</Button>
```

## 📝 Step-by-Step Migration Process

### Step 1: Add Imports
```tsx
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/primitives/icon'
```

### Step 2: Identify Button Type
- Primary action → `variant="default"`
- Secondary action → `variant="secondary"` or `variant="outline"`
- Cancel/dismiss → `variant="outline"` or `variant="ghost"`
- Delete/remove → `variant="destructive"`
- Icon only → `variant="ghost" size="icon"`
- Brand action → `variant="mindx"`

### Step 3: Replace Button
1. Copy the button's onClick, disabled, type, etc.
2. Choose appropriate variant and size
3. Move children content
4. Add custom className if needed for special styling

### Step 4: Test
- Visual appearance
- Hover/focus states
- Click functionality
- Accessibility (keyboard navigation)

## 🎨 Variant Selection Guide

| Use Case | Variant | Example |
|----------|---------|---------|
| Main action | `default` | Submit form, Save changes |
| Secondary action | `secondary` or `outline` | Cancel, Back |
| Tertiary action | `ghost` | Dismiss, Skip |
| Dangerous action | `destructive` | Delete, Remove |
| Navigation | `outline` or `ghost` | View all, See more |
| Icon only | `ghost` + `size="icon"` | Close (X), Menu |
| Brand action | `mindx` | Special CTA |
| Success action | `success` | Approve, Confirm |

## 🔧 Common Issues & Solutions

### Issue 1: Button too wide
```tsx
// Add w-full or specific width
<Button variant="outline" className="w-full">
  Full width button
</Button>
```

### Issue 2: Need custom colors
```tsx
// Override with className
<Button
  variant="outline"
  className="bg-purple-600 text-white hover:bg-purple-700 border-0"
>
  Custom color
</Button>
```

### Issue 3: Icon not showing correctly
```tsx
// Use Icon component instead of direct lucide icon
import { Icon } from '@/components/ui/primitives/icon'
import { Check } from 'lucide-react'

<Button>
  <Icon icon={Check} size="sm" />
  Save
</Button>
```

### Issue 4: Link button not working
```tsx
// Use asChild prop
<Button variant="outline" asChild>
  <Link href="/path">Go to page</Link>
</Button>
```

## 📈 Progress Tracking

### Completed ✅
- [x] `components/sidebar.tsx`
- [x] `components/slider-sidebar.tsx`
- [x] `components/upcoming-events-sidebar.tsx`

### In Progress 🔄
- [ ] `app/admin/user-management/components/UsersTab.tsx`
- [ ] `app/admin/page4/thu-vien-de/page.tsx`

### To Do 📋
- [ ] 69 more files...

## 💡 Tips

1. **Start small**: Migrate one file at a time
2. **Test immediately**: Check visual and functional changes
3. **Keep custom styling**: Use className when brand identity requires it
4. **Use variants**: Don't create new variants unless absolutely necessary
5. **Document special cases**: If you need custom styling, add a comment why

## 🎯 Goal

**Achieve 100% button consistency** across the application for:
- Better maintainability
- Consistent user experience
- Improved accessibility
- Smaller bundle size
- Faster development

---

**Last Updated**: After completing `upcoming-events-sidebar.tsx` migration
**Next Target**: `app/admin/user-management/components/UsersTab.tsx` (17 buttons)
