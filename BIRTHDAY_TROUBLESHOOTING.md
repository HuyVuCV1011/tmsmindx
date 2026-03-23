# Birthday Feature - Troubleshooting Guide

## Problem: Birthday không hiển thị hoặc không update realtime

### Step 1: Verify GAS API Connection

**Test endpoint**: `GET /api/debug/birthdays?email=YOUR_EMAIL`

Thay thế `YOUR_EMAIL` với email công việc của bạn (ví dụ: `thinhpx33@mindx.com`)

```bash
# In terminal (with server running):
curl "http://localhost:3000/api/debug/birthdays?email=thinhpx33@mindx.com"
```

**Expected response**:
```json
{
  "timestamp": "2026-03-12T...",
  "email_provided": "thinhpx33@mindx.com",
  "errors": [],
  "tests": {
    "gas_birthday_api": {
      "ok": true,
      "status": 200,
      "total_records": 45
    },
    "gas_teacher_list": {
      "ok": true,
      "matched_teacher": {
        "emailCongViec": "thinhpx33@mindx.com",
        "usernameLms": "thinhpx33"
      }
    },
    "gas_teacher_profile": {
      "ok": true,
      "area": "HCM 3"
    },
    "database_privacy": {
      "settings_exist": true
    }
  }
}
```

---

## Troubleshooting by Symptom

### ❌ No birthdays showing at all

**Check**:
1. ✓ Birthday is in current week (3-9 Mar)
   - Tuần 1: 1-7
   - Tuần 2: 8-14
   - Tuần 3: 15-21
   - Tuần 4: 22+

2. ✓ Coffee_birthday_api.status = 200
   - If not 200: GAS API is down or unreachable
   - Check GAS URL in `/app/api/birthdays/route.ts` line 7

3. ✓ gas_teacher_list.matched_teacher is not null
   - If null: Email not found in GAS server
   - Check email matches exactly (case-sensitive)
   - Try different email format if it fails

4. ✓ gas_teacher_profile.area is not null
   - If null: Area field not found for this teacher
   - Might need GAS update to include area in profile response

5. ✓ database_privacy.settings_exist = true
   - If false: Database record not created yet
   - Should auto-create on first API call

---

### ❌ Birthdays show but privacy toggle doesn't work

**Check realtime update flow**:

1. **Open DevTools Console** (F12 → Console tab)

2. **Go to Profile page** (`/user/profile`)

3. **Toggle "Ẩn thông tin sinh nhật"** and check logs:

```
Expected logs:
✓ [Privacy] show_birthday changed, invalidating cache...
✓ [Privacy] Cache invalidated successfully
✓ [Privacy] Dispatching privacy-setting-changed event
✓ [Birthday Sidebar] Privacy setting changed event received, revalidating...
✓ [Birthdays API] Cache check - key: birthdays-2026-3, valid: false
✓ [Birthdays API] Fetching fresh data from GAS + DB
```

**If "Dispatching..." log appears but "Privacy setting changed event" doesn't**:
- Event listener not attached properly
- Check `/components/upcoming-events-sidebar.tsx` line 80-94
- Sidebar component might not be mounted yet

**If "Privacy setting changed event" appears but birthday still masked**:
- API cache not cleared properly
- Check if `hiddenEmails` Set includes your email (case-sensitive)
- Verify DB query returned correct results

---

### ❌ Only some birthdays show (area filtering issue)

**Check area resolution**:

In debug response, look for:
```json
{
  "tests": {
    "gas_teacher_profile": {
      "area": "HCM 3"  // Should match your area
    }
  }
}
```

**If area is null**:
- GAS API doesn't return area in teacher profile
- Need to update GAS script or alternative approach

**If area is wrong**:
- You might be in different area than expected
- Check GAS backend to verify area assignment

---

## Common Issues & Solutions

### Issue 1: "Email not found in GAS server"

**Solution**:
- Check GAS list API returns correct email format
- Add console.log to verify email being sent
- Try different email variations:
  - `thinhpx33@mindx.com` vs `thinhpx33`
  - Case differences: `Thinhpx33@MINDX.com`

### Issue 2: "Cache keeps showing old data"

**Solution**:
- Manually clear cache:
  - Open DevTools → Application → LocalStorage
  - Delete all Next.js cache entries
  - Reload page

- Or force cache clear:
  ```bash
  curl -X POST "http://localhost:3000/api/birthdays/invalidate"
  ```

### Issue 3: "SWR cache conflicts with API cache"

**Solution**:
- SWR has separate cache layer
- When mutate() called, it should refetch
- If still seeing old data:
  - Check browser Network tab → see API response
  - Verify response has `fromCache: false`
  - Check response has correct `masked` status

### Issue 4: "Area filtering not working"

**Solution**:
- Check if GAS API returns area in birthday list
- Currently code fetches area separately (inefficient)
- If GAS doesn't support it, filtering may fail
- Workaround: Skip area filtering initially, just show all birthdays

---

## Debug Logging

All components have detailed logging. To view:

**Backend logs** (Server terminal):
```
[Birthdays API] Cache check - key: birthdays-2026-3, valid: true
[Birthdays API] Using cached data
[Birthdays API] Privacy applied - total: 5, masked: 1
[Cache] Invalidated birthdays cache for 2026-3
```

**Frontend logs** (Browser DevTools → Console):
```
[Birthday Sidebar] Privacy setting changed event received, revalidating...
[Birthday Debug] user.email: thinhpx33@mindx.com
[Birthday Debug] username resolved: thinhpx33
[Birthday Debug] leader.area: HCM 3
[Birthday Debug] birthdays count: 3
```

---

## Testing Checklist

- [ ] Run debug endpoint with your email
- [ ] All GAS API tests return ok: true
- [ ] Matched teacher found with correct username
- [ ] Area resolved correctly
- [ ] Database privacy settings exist
- [ ] Toggle privacy setting on profile page
- [ ] Check DevTools logs for event dispatch
- [ ] Verify sidebar updates realtime
- [ ] Check masked name format: "Họ T. H."
- [ ] Verify lock icon appears for hidden birthdays

---

## Files to Review

If debugging specific issues:

| Issue | File | Line |
|-------|------|------|
| Birthday fetching | `app/api/birthdays/route.ts` | 195-250 |
| Cache logic | `lib/birthday-cache.ts` | 17-62 |
| Privacy masking | `app/api/birthdays/route.ts` | 274-283 |
| Area filtering | `app/api/birthdays/route.ts` | 291-303 |
| Event dispatch | `app/user/profile/page.tsx` | 110-130 |
| Event listener | `components/upcoming-events-sidebar.tsx` | 80-94 |
| API debug | `app/api/debug/birthdays/route.ts` | All |

---

## Contact Support

If issues persist:
1. Share output from `GET /api/debug/birthdays?email=YOUR_EMAIL`
2. Share console logs from DevTools (copy whole console output)
3. Share server logs when performing test
4. Check if GAS API endpoint is accessible (might be behind firewall)
