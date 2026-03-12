# Birthday Feature - Full Review & Issues

## Status
Today: 12 tháng 3, 2026
Build status: ✅ Success

## Issues Found & Fixed

### 1. ✅ FIXED: UserArea Double Fetch
**Issue**: `userArea` was fetched twice:
- Once inside Promise.all (not used)
- Once outside if block (actual usage)

**Fix**: Moved `fetchTeacherArea` outside cache logic to fetch only once
**File**: `/app/api/birthdays/route.ts` line 195-198

```typescript
// BEFORE: fetched 2 times
if (isCached) { ... } else { 
    const [userArea, gasResponse, fetchedHiddenEmails] = await Promise.all([...])
}
const userArea = username ? await fetchTeacherArea(username) : null // 2nd fetch

// AFTER: fetched 1 time
const userArea = username ? await fetchTeacherArea(username) : null
if (isCached) { ... } else { ... }
```

---

## Potential Issues to Verify

### 2. ⚠️ Email Case Sensitivity
**Issue**: Email comparison might be case-sensitive
- GAS API: May return "user@example.com"
- Auth context: May store "User@Example.com"
- DB query: Case-sensitive by default

**Status**: Added `.toLowerCase()` in relevant places but needs testing
**Affected Files**:
- `/app/api/birthdays/route.ts` - resolveUsernameFromEmail (line 155)
- `/lib/birthday-cache.ts` - hiddenEmails Set uses `.toLowerCase()`
- `/app/api/teacher-privacy/route.ts` - DB query

**Action**: Use debug endpoint to verify email matching

---

### 3. ⚠️ GAS API Response Format Inconsistency
**Issue**: GAS responses might have different structures
```javascript
// API could return any of these:
[{ ...record }, { ...record }]          // Direct array
{ data: [{ ...record }] }                // Wrapped in data
{ result: [{ ...record }] }              // Wrapped in result
{ teachers: [{ ...record }] }            // Wrapped in teachers
```

**Status**: Code handles all cases (lines 229-237 in birthdays/route.ts)
**Action**: Use debug endpoint to verify actual response format

---

### 4. ⚠️ Area Filtering Performance
**Issue**: Fetches area for each birthday individually
```typescript
const areasResult = await Promise.all(
    weekBirthdays.map(b => fetchTeacherArea(b.username || ''))
)
```

**Risk**: With 10 birthdays in week, makes 10 API calls to GAS
**Optimization**: Could be done if GAS API returns area in birthday list
**Action**: Check if GAS birthday list includes area field

---

### 5. ⚠️ Cache Invalidation Timing
**Issue**: Realtime update flow has multiple cache layers:
- Backend cache: `lib/birthday-cache.ts` (in-memory)
- SWR cache: Browser-side caching
- Server response: May have cache headers

**Flow**:
```
User toggles show_birthday
  ↓
profile.tsx: PUT /api/teacher-privacy
  - Updates DB
  - Calls POST /api/birthdays/invalidate
  - Dispatches 'privacy-setting-changed' event
  ↓
teacher-privacy route.ts: Also calls invalidateCurrentAndNeighboringMonths()
  ↓
upcoming-events-sidebar.tsx: Listens for event
  - Calls mutateBirthdays() (SWR revalidate)
  ↓
SWR makes GET /api/birthdays?email=XXX
  - API checks backend cache
  - Should be cleared, returns fresh data
```

**Potential points of failure**:
- [ ] Event not dispatching from profile.tsx
- [ ] Sidebar listener not attached properly
- [ ] Cache not cleared in teacher-privacy endpoint
- [ ] SWR cache not being invalidated
- [ ] Response has Cache-Control headers preventing fresh data

---

### 6. ⚠️ Email Resolution Dependency
**Issue**: Sidebar needs `user?.email` to resolve username
```typescript
const birthdaysApiUrl = useMemo(() => {
    const params = new URLSearchParams()
    if (user?.email) params.set('email', user.email)
    ...
}, [user?.email, fallbackUsernameLms])
```

**Problem**: If `user?.email` is undefined on first render:
- API called without email param
- Username resolution skipped (fallback used or auth resolved)
- Works but inefficient

**Status**: Should work but slower without email param
**Action**: Verify user.email is set when auth context loads

---

## Testing Checklist

### Debug Endpoint
```bash
# Test full flow with specific email
GET /api/debug/birthdays?email=teacher@example.com
```

This endpoint tests:
- ✅ GAS birthday API response format
- ✅ GAS teacher list API (email resolution)
- ✅ GAS teacher profile API (area fetching)
- ✅ Database privacy settings
- ✅ Database hidden birthdays query

---

### Manual Testing Steps

1. **Verify Email Resolution**
   - Go to `/api/debug/birthdays?email=YOUR_EMAIL`
   - Check if `matched_teacher` is not null
   - Verify `usernameLms` is correct

2. **Verify Birthday Fetching**
   - Check `gas_birthday_api` in debug response
   - Confirm data array has records with `hoVaTen`, `ngaySinh`, `emailCongViec`
   - Verify format matches code expectations (line 60 in birthdays/route.ts)

3. **Verify Privacy Toggle**
   - Go to user profile page
   - Open DevTools Console
   - Toggle `show_birthday` setting
   - Look for console logs:
     ```
     [Privacy] show_birthday changed
     [Privacy] Cache invalidated successfully
     [Privacy] Dispatching privacy-setting-changed event
     [Birthday Sidebar] Privacy setting changed event received, revalidating...
     [Birthdays API] Cache check - key: birthdays-2026-3, valid: false
     [Birthdays API] Fetching fresh data from GAS + DB
     ```

4. **Verify Real-time Update**
   - Same as above, but check if birthday display changes
   - If masked: should show "Họ T. H." format with lock icon
   - If unmasked: should show real name with teaching level

---

## Code Locations

| Component | File | Purpose |
|-----------|------|---------|
| Birthday fetching | `/app/api/birthdays/route.ts` | Main API - fetch, cache, filter, mask |
| Cache management | `/lib/birthday-cache.ts` | In-memory cache with TTL |
| Cache invalidation | `/app/api/birthdays/invalidate/route.ts` | Force clear cache |
| Privacy settings | `/app/api/teacher-privacy/route.ts` | Store/update show_birthday |
| Sidebar display | `/components/upcoming-events-sidebar.tsx` | Show birthdays + listen for updates |
| Profile toggle | `/app/user/profile/page.tsx` | Toggle privacy setting |
| Debug endpoint | `/app/api/debug/birthdays/route.ts` | Test all components |

---

## GAS API Endpoints (Hardcoded)

```
https://script.google.com/macros/s/AKfycbxgtpi2ZxtWxzcXwcfO-l0_Qy43sXgy97yIh7F1YX2TgxvH_5AdbxfjDM24l0CSQGDQhQ/exec
```

Query strings:
- `?action=birthday&month=3` → Birthday list for month 3
- `?username=thinhpx33` → Teacher profile with area
- `?action=list&status=Đang làm` → All active teachers with email mapping

---

## Next Steps

1. **Immediate**: Use debug endpoint to test GAS API integration
2. **Verify**: Check if email resolution works for your login email
3. **Test**: Toggle privacy setting and check realtime update in DevTools
4. **Optimize**: If GAS birthday API can provide area field, remove individual area fetches

---

## Summary

✅ Code is logically correct and builds successfully  
✅ All error handling and logging in place  
⚠️ Needs runtime verification to confirm email/area matching works  
⚠️ Cache invalidation flow untested in actual browser  

**User should use `/api/debug/birthdays?email=YOUR_EMAIL` first to diagnose any issues**
