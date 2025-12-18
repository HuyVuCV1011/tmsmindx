# Google Apps Script Setup

## 1. Feedback Collection Script

### Bước 1: Tạo Google Sheet cho Feedback
1. Tạo Google Sheet mới tên "Teaching MS - Feedback"
2. Tạo các cột: **Timestamp | User Code | Rating | Comment | Feature Request**

### Bước 2: Tạo Apps Script
1. Mở Sheet → Extensions → Apps Script
2. Paste code sau:

```javascript
function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Feedback');
    
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    const timestamp = data.timestamp || new Date().toISOString();
    const userCode = data.userCode || 'anonymous';
    const rating = data.rating || 0;
    const comment = data.comment || '';
    const feature = data.feature || '';
    
    // Add row to sheet
    sheet.appendRow([
      timestamp,
      userCode,
      rating,
      comment,
      feature
    ]);
    
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: true, 
        message: 'Feedback received' 
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: false, 
        error: error.toString() 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Bước 3: Deploy
1. Click "Deploy" → "New deployment"
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Copy URL và thay vào `FEEDBACK_SCRIPT_URL` trong `/api/feedback/route.ts`

---

## 2. Analytics Tracking Script

### Bước 1: Tạo Google Sheet cho Analytics
1. Tạo Google Sheet mới tên "Teaching MS - Analytics"
2. Tạo 2 sheets:
   - Sheet "Logs": Timestamp | Action | Search Code
   - Sheet "Stats": Key | Value

### Bước 2: Tạo Apps Script
1. Mở Sheet → Extensions → Apps Script
2. Paste code sau:

```javascript
function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logsSheet = ss.getSheetByName('Logs');
    
    // Parse incoming data
    const data = JSON.parse(e.postData.contents);
    const timestamp = data.timestamp || new Date().toISOString();
    const action = data.action || 'unknown'; // 'visit' or 'search'
    const searchCode = data.searchCode || '';
    
    // Add log entry
    logsSheet.appendRow([
      timestamp,
      action,
      searchCode
    ]);
    
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: true, 
        message: 'Analytics tracked' 
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        success: false, 
        error: error.toString() 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logsSheet = ss.getSheetByName('Logs');
    
    const data = logsSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // Count visits
    const totalVisits = rows.filter(row => row[1] === 'visit').length;
    
    // Count searches
    const totalSearches = rows.filter(row => row[1] === 'search').length;
    
    // Get all search codes
    const searchRows = rows.filter(row => row[1] === 'search' && row[2]);
    const searchCodes = searchRows.map(row => row[2]);
    
    // Count unique searches
    const uniqueSearches = new Set(searchCodes).size;
    
    // Count top searches
    const searchCounts = {};
    searchCodes.forEach(code => {
      searchCounts[code] = (searchCounts[code] || 0) + 1;
    });
    
    const topSearches = Object.entries(searchCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count }));
    
    // Get recent searches (last 10)
    const recentSearches = searchRows
      .slice(-10)
      .reverse()
      .map(row => ({
        code: row[2],
        timestamp: row[0]
      }));
    
    return ContentService.createTextOutput(
      JSON.stringify({
        totalVisits,
        totalSearches,
        uniqueSearches,
        topSearches,
        recentSearches
      })
    ).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ 
        error: error.toString() 
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Bước 3: Deploy
1. Click "Deploy" → "New deployment"
2. Type: Web app
3. Execute as: Me
4. Who has access: Anyone
5. Copy URL và thay vào `ANALYTICS_SCRIPT_URL` trong `/api/analytics/route.ts`

---

## 3. Xem Analytics Dashboard

### Tạo trang Analytics
File: `/app/analytics/page.tsx`

```typescript
'use client';
import { useState, useEffect } from 'react';

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Analytics Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-600 mb-2">Tổng lượt truy cập</h2>
          <p className="text-4xl font-bold text-blue-600">{stats?.totalVisits || 0}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-600 mb-2">Tổng lượt tìm kiếm</h2>
          <p className="text-4xl font-bold text-green-600">{stats?.totalSearches || 0}</p>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Top 10 mã được tìm nhiều nhất</h2>
        <div className="space-y-2">
          {stats?.topSearches?.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-400">#{index + 1}</span>
                <span className="font-medium">{item.code}</span>
              </div>
              <span className="text-sm text-gray-600">{item.count} lượt</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Cách sử dụng

1. **Setup Feedback Sheet**: Tạo sheet và deploy script cho feedback
2. **Setup Analytics Sheet**: Tạo sheet và deploy script cho analytics
3. **Update API Routes**: Thay các URL script vào 2 file:
   - `/api/feedback/route.ts` → `FEEDBACK_SCRIPT_URL`
   - `/api/analytics/route.ts` → `ANALYTICS_SCRIPT_URL`
4. **Test**: 
   - Truy cập trang → Kiểm tra Logs sheet có record "visit"
   - Tìm kiếm giáo viên → Kiểm tra Logs sheet có record "search"
   - Click nút feedback → Gửi feedback → Kiểm tra Feedback sheet
5. **View Analytics**: Truy cập `/analytics` để xem dashboard

---

## Troubleshooting

**Lỗi CORS**:
- Đảm bảo Apps Script được deploy với "Who has access: Anyone"
- Kiểm tra URL có đúng không

**Không ghi được data**:
- Kiểm tra tên sheet trong script khớp với tên sheet thực tế
- Kiểm tra quyền truy cập của Apps Script

**Analytics không cập nhật**:
- Đợi vài giây sau khi deploy mới script
- Clear cache: `next: { revalidate: 0 }` trong GET request
