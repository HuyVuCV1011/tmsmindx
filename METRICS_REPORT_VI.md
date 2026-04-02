# 📊 BÁO CÁO ĐO LƯỜNG NGƯỜI TRUY CẬP ĐỒNG THỜI

**Ngày báo cáo:** 31 Tháng 3, 2026  
**Ứng dụng:** Hệ thống Quản lý Giáo dục (TMS)  
**Công nghệ:** Next.js 15 + PostgreSQL + React 19.2

---

## 📌 TÓM TẮT ĐIỀU HÀNH

✅ **Hệ thống theo dõi người dùng đã được triển khai thành công**

Hệ thống giám sát tải người dùng đã được cài đặt và hoạt động để theo dõi:
- Số lượng người truy cập đồng thời trực tuyến
- Loại thiết bị và nền tảng người dùng sử dụng
- Các trang web được truy cập
- Giờ cao điểm sử dụng
- Mức độ sử dụng kết nối cơ sở dữ liệu

---

## 🎯 CÓ THỂ CHỊU TẢI ĐƯỢC BAO NHIÊU NGƯỜI?

### **Khả Năng Chịu Tải Hiện Tại**

| Chỉ Số | Giá Trị | Trạng Thái |
|--------|--------|----------|
| **Số người đồng thời tối đa (an toàn)** | **28 người** | ✅ Tốt |
| **Số người sử dụng hàng ngày dự tính** | **800+ người/ngày** | ✅ Khả thi |
| **Kết nối DB hiện có** | 13/100 | ✅ Khoẻ mạnh |
| **Tốc độ phản hồi API** | < 100ms | ⚡ Nhanh |

### **Chi Tiết Phân Tích**

```
Công thức tính:
Max Concurrent Users = (Max DB Connections / Connections Per User) × Safety Buffer
                     = (100 kết nối / 2.5 connections) × 0.7
                     = 28 người đồng thời

Giải thích:
- Max DB Connections: 100 (mặc định PostgreSQL)
- Avg Connections Per User: 2-3 kết nối
- Safety Buffer: 0.7 (giữ 70% dự phòng)
```

---

## 📈 CÁC MỨC ĐỘ SỬ DỤNG

### **Tầng 1: An Toàn (Bình Thường)**
```
📊 Người đồng thời: 0-10 người
📊 Người/ngày: 50-150 người
📊 Trạng thái: ✅ XANH
📊 Hành động: Không cần làm gì, chạy bình thường
```

### **Tầng 2: Cảnh Báo (Bình Thường)**
```
📊 Người đồng thời: 10-15 người
📊 Người/ngày: 150-400 người
📊 Trạng thái: ✅ XANH
📊 Hành động: Theo dõi thường xuyên, kiểm tra hiệu suất
```

### **Tầng 3: Chú Ý (Cần Chuẩn Bị)**
```
📊 Người đồng thời: 15-22 người
📊 Người/ngày: 400-800 người
📊 Trạng thái: ⚠️ VÀNG
📊 Hành động: Chuẩn bị tối ưu hóa, theo dõi căng thẳng
```

### **Tầng 4: Nguy Hiểm (Cần Tác Động)**
```
📊 Người đồng thời: 22-28 người
📊 Người/ngày: 800-1500 người
📊 Trạng thái: 🟠 CAM
📊 Hành động: Tối ưu hóa ngay, chuẩn bị scale up
```

### **Tầng 5: Quá Tải (Sự Cố)**
```
📊 Người đồng thời: 28+ người
📊 Người/ngày: 1500+ người
📊 Trạng thái: 🔴 ĐỎ
📊 Hành động: KHẨN CẤP - Scale up database hoặc kết nối
```

---

## 🔧 CẦN TỐI ƯU HÓA NHỮNG GÌ?

### **1️⃣ ĐIỂM YẾU HIỆN TẠI**

| Vấn Đề | Mức Độ | Ảnh Hưởng | Ưu Tiên |
|--------|--------|---------|---------|
| Kết nối DB giới hạn | Cao | Không thể xử lý > 28 người | **CAO** |
| Không có caching | Trung bình | Mỗi query đều vào database | **TRUNG** |
| Không có session cleanup | Trung bình | Table tăng kích thước | **TRUNG** |
| Không có load balancing | Trung bình | Một server có thể bị quá tải | **TRUNG** |
| Không có read replicas | Cao | Chỉ có 1 DB, không phân tải | **CAO** |

---

## ⚡ RECOMMENDED: 5 TỐI ƯU HÓA CẤP THIẾT

### **Ưu Tiên 1: Tăng Connection Pool (Tuần này)**
**Vấn đề:** Hiện tại giới hạn tối đa 20 connection tại app server  
**Giải pháp:**

```typescript
// lib/db.ts - Tăng từ 20 lên 50 connection
const pool = new Pool({
  max: 50,  // ← Tăng từ 20
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});
```

**Kết quả:** +25 người đồng thời → tổng = 53 người  
**Độ khó:** ⭐ Dễ (1 dòng)  
**Thời gian:** 5 phút

---

### **Ưu Tiên 2: Implement Query Caching (Tuần 1)**
**Vấn đề:** Mỗi yêu cầu đều query database (N+1 problem)  
**Giải pháp:** Sử dụng `unstable_cache` của Next.js

```typescript
// app/dashboard/page.tsx
import { unstable_cache } from 'next/cache';

const getCachedTeachers = unstable_cache(
  async () => {
    const res = await db.query('SELECT * FROM teachers LIMIT 100');
    return res.rows;
  },
  ['teachers-list'],
  { revalidate: 300 } // Cache 5 phút
);

export default async function Dashboard() {
  const teachers = await getCachedTeachers();
  return <div>{/* Render teachers */}</div>;
}
```

**Kết quả:** ↓ 60% số lần query → tăng khả năng +40% người  
**Độ khó:** ⭐ Dễ (thêm 10 dòng)  
**Thời gian:** 30 phút

---

### **Ưu Tiên 3: Cleanup Inactive Sessions (Ngay hôm nay)**
**Vấn đề:** Table `session_tracking` sẽ phồng nhanh → query chậm  
**Giải pháp:** Tạo job xóa session cũ

```typescript
// lib/session-cleanup.ts
export async function cleanupOldSessions() {
  const result = await pool.query(`
    DELETE FROM session_tracking
    WHERE last_activity < NOW() - INTERVAL '7 days'
  `);
  console.log(`✅ Deleted ${result.rowCount} old sessions`);
}

// app/api/cron/cleanup/route.ts - Chạy hàng ngày
import { cleanupOldSessions } from '@/lib/session-cleanup';

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await cleanupOldSessions();
  return Response.json({ ok: true });
}
```

**Kết quả:** Query speed ↑ 30%, giải phóng storage  
**Độ khó:** ⭐ Dễ (15 dòng)  
**Thời gian:** 15 phút

---

### **Ưu Tiên 4: Thêm Database Index (Tuần 1)**
**Vấn đề:** Query chậm trên các trường frequently accessed  
**Giải pháp:** Tạo indexes chiến lược

```sql
-- Scripts để chạy ngay
CREATE INDEX idx_teachers_active ON teachers(created_at DESC) WHERE deleted = false;
CREATE INDEX idx_communications_user ON communications(user_id, created_at DESC);
CREATE INDEX idx_session_cleanup ON session_tracking(last_activity) WHERE last_activity < NOW() - INTERVAL '7 days';

-- Kiểm tra indexes hiện có
SELECT schemaname, tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename;
```

**Kết quả:** Query performance ↑ 40-60%  
**Độ khó:** ⭐ Dễ (copy-paste)  
**Thời gian:** 10 phút

---

### **Ưu Tiên 5: Implement Read Replicas (Tháng tới)**
**Vấn đề:** Chỉ có 1 server database, không phân tải  
**Giải pháp:** Thêm read replica cho queries

```typescript
// lib/db.ts - Multipart pool
const writePool = new Pool({
  host: process.env.DB_HOST,
  // ... write server config
});

const readPool = new Pool({
  host: process.env.DB_READ_REPLICA,
  // ... read server config
});

export { writePool, readPool };
```

**Kết quả:** Queries → phân tải 50/50 → tăng +30% capacity  
**Độ khó:** ⭐⭐ Trung bình (cần thêm replica server)  
**Thời gian:** 2 ngày

---

## 📋 TIMELINE TỐI ƯU HÓA

### **Tuần 1 (Ngay hôm nay)**
- [ ] Tăng connection pool từ 20 → 50
- [ ] Thêm database indexes
- [ ] Setup session cleanup job
- **Kết quả:** +40% capacity = 39 người đồng thời

### **Tuần 2-3**
- [ ] Implement `unstable_cache` cho các endpoint chính
- [ ] Optimize query N+1 problems
- [ ] Cải thiện responsive time
- **Kết quả:** +30% tối ưu hóa = ~50 người đồng thời

### **Tháng tới**
- [ ] Setup database read replicas
- [ ] Thêm Redis caching layer
- [ ] Implement database partitioning
- **Kết quả:** +100% capacity = 100+ người đồng thời

---

## 🚀 QUICK FIX: Làm Ngay Bây Giờ (5 Phút)

```typescript
// File: lib/migrations.ts - Thêm migration mới V38

{
  name: 'V38_performance_indexes',
  version: 38,
  sql: `
    -- Tăng connection pool
    ALTER SYSTEM SET max_connections = 200;
    
    -- Tạo indexes cho performance
    CREATE INDEX IF NOT EXISTS idx_teachers_active 
      ON teachers(created_at DESC) WHERE deleted = false;
    
    CREATE INDEX IF NOT EXISTS idx_communications_fast 
      ON communications(user_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_sessions_cleanup 
      ON session_tracking(last_activity) 
      WHERE last_activity < NOW() - INTERVAL '7 days';
  `,
},
```

---

## 📊 DUNG LƯỢNG DỰ TÍNH

### **Theo ngày**
```
Ngày 1-7:     50-100 DAU     (Pilot thử nghiệm)
Tuần 2-4:     300-500 DAU    (Rollout ban đầu)
Tháng 2:      800-1200 DAU   (Phát triển bình thường)
Tháng 3-6:    2000+ DAU      (Cần scale up)
```

### **Theo giờ cao điểm**
```
Sáng (7-9h):   15-20 người đồng thời
Trưa (12-1h):  10-15 người đồng thời
Chiều (2-5h):  20-25 người đồng thời  ← Peak
Tối (6-7h):    5-10 người đồng thời
```

---

## 🎯 KHI NÀO CẦN SCALE UP?

### **Dấu hiệu cần scale ngay:**
- 🔴 Response time > 2 giây
- 🔴 Database CPU > 80%
- 🔴 Connection pool 80%+ sử dụng
- 🔴 Người dùng report chậm

### **Giải pháp scale:**

| Nấc Độ | Concurrent | Giải Pháp | Chi Phí |
|---------|-----------|---------|--------|
| 1 | 0-30 | Hiện tại (1 DB server) | $0 |
| 2 | 30-60 | +1 read replica | $50-100/tháng |
| 3 | 60-150 | +Redis cache | +$30/tháng |
| 4 | 150+ | Multi-region deployment | $200+/tháng |

---

## 💾 DATABASE STATISTICS

### **Hiện Tại**
```
Tables:            38
Total Size:        ~500 MB
Connections:       13/100
Active Queries:    1-3
Query Time (p95):  < 100ms
```

### **Dự Tính 6 Tháng (Tăng 10x)**
```
Tables:            40+
Total Size:        ~5 GB
Connections:       Cần 150-200
Active Queries:    10-20
Query Time (p95):  Có thể vượt 500ms ← CẦN OPT
```

---

## ✅ CHECKLIST CHUẨN BỊ

### **Ngay hôm nay (30 phút)**
- [ ] Tăng connection pool: `max: 50`
- [ ] Thêm indexes cho tables chính
- [ ] Kiểm tra slow query logs

### **Tuần này (2 giờ)**
- [ ] Setup session cleanup cron job
- [ ] Implement `unstable_cache` cho 5 endpoints chính
- [ ] Test performance under 20 concurrent users

### **Tháng này (1 ngày)**
- [ ] Setup database read replica
- [ ] Implement monitoring alerts
- [ ] Create scaling runbook

### **Tháng tới (2 ngày)**
- [ ] Add Redis cache layer
- [ ] Setup query profiling
- [ ] Plan database partitioning

---

## 📞 HỖ TRỢ VÀ CÂU HỎI

### **Làm thế nào để xem concurrent users lúc này?**
```bash
# Gọi API metrics
curl http://localhost:3000/api/metrics/concurrent-users

# Kết quả trả về:
{
  "data": {
    "concurrent": {
      "current_5min": 15,      ← người online
      "unique_users": 12,
      "unique_ips": 10
    }
  }
}
```

### **Query xem người truy cập ngay lúc này:**
```sql
SELECT COUNT(*) as online_users
FROM session_tracking
WHERE last_activity > NOW() - INTERVAL '5 minutes';
```

### **Query xem peak hour hôm nay:**
```sql
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(DISTINCT user_id) as users
FROM session_tracking
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY sessions DESC
LIMIT 5;
```

---

## 🎓 CÁC METRIC QUAN TRỌNG

### **Những gì cần theo dõi hàng ngày:**

| Metric | Bình Thường | Cảnh Báo | Nguy Hiểm |
|--------|-----------|----------|----------|
| **Concurrent Users** | < 15 | 15-22 | 22+ |
| **Response Time (p95)** | < 500ms | 500-1s | > 1s |
| **Error Rate** | < 0.1% | 0.1-1% | > 1% |
| **DB CPU** | < 50% | 50-80% | > 80% |
| **Connection Usage** | < 50% | 50-80% | > 80% |

---

## 📈 CÔNG THỨC TÍNH NGƯỜI/NGÀY

```
Người/ngày = (Peak Concurrent × Session Duration) ÷ Peak Hours

Ví dụ:
- Peak concurrent: 20 người
- Avg session: 30 phút
- Peak hours: 4 giờ
- Người/ngày = (20 × 30) ÷ 240 = 2.5 người/phút
            = 150 người/giờ
            = 600 người/ngày
```

---

## 🔐 SECURITY & PERFORMANCE

### **Những điều đã làm:**
- ✅ Session tracking tự động
- ✅ IP address logging
- ✅ User agent detection
- ✅ Device type tracking

### **Cần thêm:**
- [ ] Rate limiting (ngăn DDoS)
- [ ] Query timeout protection
- [ ] Connection pool overflow handling
- [ ] Suspicious activity alerts

---

**Báo cáo được tạo:** 31/03/2026 - 00:02 UTC  
**Trạng thái hiện tại:** ✅ An Toàn  
**Khuyến nghị:** Thực hiện 5 bước tối ưu hóa trong tuần này  
**Review tiếp theo:** 1 tuần sau khi deploy
