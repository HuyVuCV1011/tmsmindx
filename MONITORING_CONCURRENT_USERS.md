# Đo Lường Concurrent Users & Dự Tính Capacity

## 📊 Tổng Quan

File này hướng dẫn chi tiết cách đo lường số lượng người truy cập đồng thời (concurrent users) cho ứng dụng Next.js 15 + PostgreSQL, giúp dự tính khả năng chịu tải của hệ thống.

**Stack hiện tại:**

- Next.js 15 (Vercel deployment)
- PostgreSQL
- Firebase Auth
- React 19.2

---

## 🎯 Phương Pháp Đo Lường Concurrent Users

### 1. **Realtime Analytics (Ngay lập tức)**

#### 1.1 Google Analytics 4 (GA4) - RECOMMENDED cho Web

**Ưu điểm:**

- ✅ Miễn phí, dễ setup
- ✅ Real-time viewed users
- ✅ Xem được số người đang truy cập lúc này
- ✅ Không cần code phức tạp

**Cách setup:**

```typescript
// lib/analytics.ts
export function initializeGoogleAnalytics() {
  if (typeof window === "undefined") return;

  // Insert vào <head>
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=G-YOUR_GA_ID";
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  gtag("js", new Date());
  gtag("config", "G-YOUR_GA_ID", {
    page_path: window.location.pathname,
  });
}
```

**Cách xem metrics:**

- Google Analytics > Reports > Realtime > Overview
- Xem "Currently active users" (người online lúc này)
- Xem "Active users past 30 mins"

---

#### 1.2 Vercel Web Analytics - EASIEST

**Ưu điểm:**

- ✅ Đơn giản nhất (chỉ 1 dòng)
- ✅ Không cần GA4 setup phức tạp
- ✅ Real-time data
- ✅ Tích hợp sẵn Vercel

**Cách setup:**

```bash
npm install @vercel/analytics @vercel/web-vitals
```

```typescript
// app/layout.tsx
import { Analytics } from "@vercel/analytics/react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Xem metrics:**

- Vercel Dashboard > Project > Analytics
- Xem real-time users

---

### 2. **Custom Session Tracking (Chi tiết nhất)**

Tạo middleware để track active sessions trong database.

#### 2.1 Tạo bảng tracking

```sql
-- File: scripts/create_session_tracking.sql
CREATE TABLE IF NOT EXISTS session_tracking (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) UNIQUE NOT NULL,
  user_id VARCHAR(255),
  user_email VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  current_route VARCHAR(500),
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_type VARCHAR(50), -- mobile, tablet, desktop
  platform VARCHAR(50)     -- web, ios, android
);

-- Index cho performance
CREATE INDEX idx_session_last_activity ON session_tracking(last_activity);
CREATE INDEX idx_session_user_id ON session_tracking(user_id);
```

#### 2.2 API endpoint đo concurrent users

```typescript
// app/api/metrics/concurrent-users/route.ts
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Người online/active trong 5 phút gần đây
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await db.query(
      `
      SELECT 
        COUNT(*) as concurrent_users,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(DISTINCT device_type) as device_types,
        JSON_AGG(DISTINCT device_type) as devices
      FROM session_tracking
      WHERE last_activity > $1
    `,
      [fiveMinutesAgo],
    );

    const data = result.rows[0];

    // Metrics chi tiết
    const routeBreakdown = await db.query(
      `
      SELECT 
        current_route,
        COUNT(*) as users_on_page,
        COUNT(DISTINCT user_id) as unique_users
      FROM session_tracking
      WHERE last_activity > $1
      GROUP BY current_route
      ORDER BY users_on_page DESC
      LIMIT 20
    `,
      [fiveMinutesAgo],
    );

    return Response.json({
      timestamp: new Date(),
      concurrent_users: {
        current_5min: data.concurrent_users,
        unique_users: data.unique_users,
        unique_ips: data.unique_ips,
      },
      breakdown: {
        by_device: data.devices,
        by_route: routeBreakdown.rows,
      },
      metrics: {
        pages_per_user: (
          routeBreakdown.rows.length / data.unique_users
        ).toFixed(2),
        bounce_rate: "Cần track view duration", // TODO
      },
    });
  } catch (error) {
    console.error("Error fetching concurrent users:", error);
    return Response.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
```

#### 2.3 Middleware track sessions

```typescript
// lib/middleware/session-tracker.ts
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export async function trackSession(
  request: Request,
  userId?: string,
  userEmail?: string,
) {
  try {
    const cookieStore = await cookies();
    let sessionId = cookieStore.get("session_id")?.value;

    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      cookieStore.set("session_id", sessionId, {
        maxAge: 24 * 60 * 60, // 24 hours
        path: "/",
        httpOnly: true,
      });
    }

    const url = new URL(request.url);
    const headers = request.headers;
    const userAgent = headers.get("user-agent") || "unknown";
    const ipAddress =
      headers.get("x-forwarded-for") || headers.get("x-real-ip") || "unknown";

    // Detect device type
    const isMobile = /mobile|android|iphone/i.test(userAgent);
    const isTablet = /tablet|ipad|kindle/i.test(userAgent);
    const deviceType = isMobile ? "mobile" : isTablet ? "tablet" : "desktop";

    // Upsert session
    await db.query(
      `
      INSERT INTO session_tracking 
      (session_id, user_id, user_email, ip_address, user_agent, current_route, device_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (session_id) DO UPDATE SET
        last_activity = CURRENT_TIMESTAMP,
        current_route = $6,
        user_id = COALESCE($2, user_id),
        user_email = COALESCE($3, user_email)
    `,
      [
        sessionId,
        userId || null,
        userEmail || null,
        ipAddress,
        userAgent,
        url.pathname,
        deviceType,
      ],
    );
  } catch (error) {
    console.error("Session tracking error:", error);
  }
}
```

#### 2.4 Integrate vào Layout

```typescript
// app/layout.tsx
import { trackSession } from "@/lib/middleware/session-tracker";
import { headers } from "next/headers";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Track session on server
  const headersList = await headers();
  const request = new Request("http://localhost", {
    headers: headersList,
  });

  await trackSession(request);

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

### 3. **Advanced Monitoring Tools**

#### 3.1 Sentry (Error + Performance)

**Tốt cho:** Error tracking + Performance monitoring

```bash
npm install @sentry/nextjs
```

```typescript
// sentry.client.config.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0.1,
});
```

**Metrics available:**

- Transaction count
- User sessions
- Performance data

---

#### 3.2 Datadog (Enterprise solution)

**Tốt cho:** Full-stack monitoring

```bash
npm install @datadog/browser-rum
```

**Cấp độ:** Enterprise, trả phí, rất mạnh

---

#### 3.3 New Relic (Recommended Alternative)

**Setup:** Sinh API key, thêm script

**Metrics:**

- Throughput
- Response time
- Error rate
- Active sessions

---

## 📈 Công Thức Dự Tính Capacity

### 1. **Tính Concurrent Users Tối Đa**

```
Max Concurrent Users = (Database Connections / Avg Connections Per User) × Buffer Factor

- Database Connections: Mặc định PostgreSQL = 100
- Avg Connections Per User: 2-3 connections
- Buffer Factor: 0.7 (để safe)

Ví dụ:
Max = (100 / 2.5) × 0.7 = 28 concurrent users (an toàn)
```

### 2. **Request per Second (RPS) Capacity**

```
Max RPS = (Server CPU Cores × 100) / Avg Processing Time (ms)

- Server CPU Cores: 4 (vd Vercel Pro)
- Avg Processing Time: 100ms

Max RPS = (4 × 100) / 100 = 4 requests/sec per instance
```

### 3. **Dự Tính Total Users (DAU - Daily Active Users)**

```
DAU Dự Tính = Concurrent Users × Session Duration / Time Window

- Concurrent Users: 50 (peak)
- Avg Session Duration: 30 minutes
- Peak Hour Duration: 2 hours

DAU = 50 × 30 / 120 = 12.5 users/minute
→ ~750 users/hour trong peak
→ ~5000+ DAU có thể
```

---

## 📊 Dashboard Metrics Cần Track

### Bảng Tracking Quan Trọng

```sql
-- Concurrent Users Timeline
SELECT
  DATE_TRUNC('minute', last_activity) as minute,
  COUNT(*) as concurrent_users,
  COUNT(DISTINCT user_id) as unique_users
FROM session_tracking
GROUP BY DATE_TRUNC('minute', last_activity)
ORDER BY minute DESC;

-- Peak Hours Analysis
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT user_id) as users,
  AVG(EXTRACT(EPOCH FROM (last_activity - created_at))) as avg_session_duration_sec
FROM session_tracking
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY sessions DESC;

-- Device Distribution
SELECT
  device_type,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER(), 2) as percentage
FROM session_tracking
WHERE last_activity > NOW() - INTERVAL '1 hour'
GROUP BY device_type;

-- Geographic Distribution (if IP tracking)
SELECT
  ip_address,
  COUNT(DISTINCT session_id) as sessions,
  MAX(last_activity) as last_seen
FROM session_tracking
GROUP BY ip_address
ORDER BY sessions DESC;
```

---

## 🛠️ Implementation Checklist

### Phase 1: Setup Cơ Bản (1-2 hours)

- [ ] Install Vercel Analytics hoặc Google Analytics
- [ ] Setup GA4 property
- [ ] Add tracking script to `app/layout.tsx`
- [ ] Test real-time data

### Phase 2: Custom Tracking (3-4 hours)

- [ ] Create `session_tracking` table
- [ ] Create `/api/metrics/concurrent-users` endpoint
- [ ] Add session tracking middleware
- [ ] Cleanup old sessions (cron job)

### Phase 3: Dashboard (2-3 hours)

- [ ] Create monitoring dashboard page
- [ ] Display real-time charts
- [ ] Setup alerts

### Phase 4: Analysis (Ongoing)

- [ ] Daily review metrics
- [ ] Monthly capacity report
- [ ] Identify growth trends

---

## 📋 Recommended Setup Order

### Bước 1: Quick Start (Ngay hôm nay)

```bash
# Setup Vercel Analytics - Easiest
npm install @vercel/analytics @vercel/web-vitals

# Add to app/layout.tsx
import { Analytics } from "@vercel/analytics/react";
```

### Bước 2: Custom Session Tracking

```bash
# Add migration
psql -d teaching_portal_system < scripts/create_session_tracking.sql

# Implement middleware
# Implement API endpoint
```

### Bước 3: Monitoring Dashboard

```typescript
// Create app/admin/monitoring/page.tsx
// Display real-time concurrent users chart
```

---

## 📌 Key Metrics to Monitor

| Metric               | Target | Warning | Critical |
| -------------------- | ------ | ------- | -------- |
| Concurrent Users     | 10     | 50      | 100      |
| Response Time (p95)  | <500ms | >1s     | >3s      |
| Database Connections | <20    | >50     | >80      |
| Error Rate           | <0.1%  | >1%     | >5%      |
| Page Load Time (LCP) | <2.5s  | >4s     | >10s     |

---

## 🚨 Cleanup Strategy (Important)

Phải cleanup old sessions để tránh bloat table:

```typescript
// scripts/cleanup-sessions.js
import cron from "node-cron";
import { db } from "@/lib/db";

// Run every hour
cron.schedule("0 * * * *", async () => {
  const result = await db.query(`
    DELETE FROM session_tracking
    WHERE last_activity < NOW() - INTERVAL '24 hours'
  `);
  console.log(`Deleted ${result.rowCount} old sessions`);
});
```

---

## 💡 Pro Tips

1. **Session Duration:** Track `last_activity - created_at` để biết user ở lại bao lâu
2. **Peak Analysis:** Identify peak hours để scale accordingly
3. **Device Split:** Mobile vs Desktop có khác nhau về behavior
4. **Geographic:** Nếu có IP tracking, xem user đến từ đâu
5. **Export Data:** Export weekly metrics để trend analysis

---

## 🔗 Useful Services

| Service            | Cost            | Use Case                         |
| ------------------ | --------------- | -------------------------------- |
| Google Analytics 4 | Free            | Real-time users, detailed events |
| Vercel Analytics   | Free (built-in) | Basic web metrics                |
| Sentry             | Free tier       | Error tracking + perf            |
| Datadog            | $15+/month      | Enterprise monitoring            |
| New Relic          | $9.99/month     | Comprehensive APM                |
| AWS CloudWatch     | Pay-per-use     | If use AWS                       |

---

## 📞 Support Needed?

```bash
# Test API endpoint
curl http://localhost:3000/api/metrics/concurrent-users

# Check database
psql -d teaching_portal_system -c "SELECT COUNT(*) FROM session_tracking;"

# Monitor live
watch -n 5 'psql -d teaching_portal_system -c "SELECT COUNT(*) FROM session_tracking WHERE last_activity > NOW() - INTERVAL 5m;"'
```

---

## 🎓 Next Steps

1. **Week 1:** Setup Vercel Analytics + Google Analytics
2. **Week 2:** Implement custom session tracking
3. **Week 3:** Create monitoring dashboard
4. **Week 4+:** Analyze patterns & optimize
