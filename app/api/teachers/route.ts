import { withApiProtection } from "@/lib/api-protection";
import { NextRequest, NextResponse } from "next/server";

const TEACHER_PROFILE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_PROFILE_CSV_URL || "";
const TEACHER_EXPERTISE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_EXPERTISE_CSV_URL || "";
const TEACHER_EXPERIENCE_CSV_URL = process.env.NEXT_PUBLIC_TEACHER_EXPERIENCE_CSV_URL || "";

// In-memory cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = {
  teachers: null as CacheEntry<Teacher[]> | null,
  expertiseRaw: null as CacheEntry<string> | null,
  experienceRaw: null as CacheEntry<string> | null,
};

const CACHE_TTL = 5 * 60 * 1000; // 5 phút

function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
}

interface Teacher {
  stt: string;
  name: string;
  code: string;
  emailMindx: string;
  emailPersonal: string;
  status: string;
  branchIn: string;
  programIn: string;
  branchCurrent: string;
  programCurrent: string;
  manager: string;
  responsible: string;
  position: string;
  startDate: string;
  onboardBy: string;
  monthlyMetrics?: {
    expertise: { [key: string]: string }; // Chuyên môn chuyên sâu
    experience: { [key: string]: string }; // Kỹ năng - Trải nghiệm
  };
}

// Fetch data từ Google Sheets với caching
async function fetchTeachersFromSheet(): Promise<Teacher[]> {
  // Kiểm tra cache
  if (isCacheValid(cache.teachers)) {
    console.log("📦 Using cached teachers data");
    return cache.teachers!.data;
  }

  try {
    console.log("🔄 Fetching fresh teachers data from Google Sheets...");
    const response = await fetch(TEACHER_PROFILE_CSV_URL, { 
      cache: 'no-store' // Không dùng Next.js cache vì đã có memory cache
    });
    
    if (!response.ok) {
      throw new Error("Cannot fetch sheet data");
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    
    // Skip header row
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const teachers: Teacher[] = dataLines.map(line => {
      // Parse CSV line (simple approach, may need improvement for quoted fields)
      const columns = line.split(",").map(col => col.trim().replace(/^"|"$/g, ""));
      
      return {
        stt: columns[0] || "",
        name: columns[1] || "",
        code: columns[2] || "",
        emailMindx: columns[3] || "",
        emailPersonal: columns[4] || "",
        status: columns[5] || "",
        branchIn: columns[6] || "",
        programIn: columns[7] || "",
        branchCurrent: columns[8] || "",
        programCurrent: columns[9] || "",
        manager: columns[10] || "",
        responsible: columns[11] || "",
        position: columns[12] || "",
        startDate: columns[13] || "",
        onboardBy: columns[14] || ""
      };
    });

    const filteredTeachers = teachers.filter(t => t.code);
    
    // Lưu vào cache
    cache.teachers = {
      data: filteredTeachers,
      timestamp: Date.now()
    };
    
    console.log(`✅ Cached ${filteredTeachers.length} teachers`);
    return filteredTeachers;
  } catch (error) {
    console.error("Error fetching from Google Sheets:", error);
    // Nếu có cache cũ, dùng nó dù đã hết hạn
    if (cache.teachers) {
      console.log("⚠️ Using stale cache due to fetch error");
      return cache.teachers.data;
    }
    return [];
  }
}

// Fetch expertise scores (Chuyên sâu) với caching
// Formula: =IFERROR(AVERAGEIFS($AH:$AH, $Z:$Z, $B$3, $AK:$AK, F$10), "3T")
async function fetchExpertiseScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    let csvText: string;
    
    // Kiểm tra cache
    if (isCacheValid(cache.expertiseRaw)) {
      console.log("📦 Using cached expertise data");
      csvText = cache.expertiseRaw!.data;
    } else {
      console.log("🔄 Fetching fresh expertise data from Google Sheets...");
      const response = await fetch(TEACHER_EXPERTISE_CSV_URL, { 
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Cannot fetch expertise data. Status: ${response.status}`);
      }

      csvText = await response.text();
      
      // Lưu vào cache
      cache.expertiseRaw = {
        data: csvText,
        timestamp: Date.now()
      };
      console.log("✅ Cached expertise data");
    }

    // Parse CSV và tính toán scores
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    const searchCode = teacherCode.toLowerCase();
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      const code = columns[25]?.trim().toLowerCase();
      if (code !== searchCode) continue; // Skip early nếu không match
      
      const scoreStr = columns[33]?.replace(",", ".").trim();
      const dateStr = columns[36]?.trim();
      
      if (dateStr && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          if (!scores[dateStr]) {
            scores[dateStr] = [];
          }
          scores[dateStr].push(score);
        }
      }
    }
    
    // Calculate average for each month and normalize date format
    const result: { [key: string]: string } = {};
    for (const [month, scoreArray] of Object.entries(scores)) {
      if (scoreArray.length > 0) {
        const avg = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
        const normalizedMonth = month.replace(/^0(\d)\//, '$1/');
        result[normalizedMonth] = avg.toFixed(1);
      }
    }
    
    console.log(`✅ Found expertise scores for ${teacherCode}:`, Object.keys(result).length, "months");
    return result;
  } catch (error) {
    console.error("Error fetching expertise scores:", error);
    return {};
  }
}

// Fetch experience scores (Trải nghiệm) với caching
// Formula: =IFERROR(AVERAGEIFS($M:$M, $E:$E, $B$3, $P:$P, F$10), "3T")
async function fetchExperienceScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    let csvText: string;
    
    // Kiểm tra cache
    if (isCacheValid(cache.experienceRaw)) {
      console.log("📦 Using cached experience data");
      csvText = cache.experienceRaw!.data;
    } else {
      console.log("🔄 Fetching fresh experience data from Google Sheets...");
      const response = await fetch(TEACHER_EXPERIENCE_CSV_URL, { 
        cache: 'no-store'
      });
      
      if (!response.ok) {
        throw new Error(`Cannot fetch experience data. Status: ${response.status}`);
      }

      csvText = await response.text();
      
      // Lưu vào cache
      cache.experienceRaw = {
        data: csvText,
        timestamp: Date.now()
      };
      console.log("✅ Cached experience data");
    }

    // Parse CSV và tính toán scores
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    const searchCode = teacherCode.toLowerCase();
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      const code = columns[4]?.trim().toLowerCase();
      if (code !== searchCode) continue; // Skip early nếu không match
      
      const scoreStr = columns[12]?.replace(",", ".").trim();
      const dateStr = columns[15]?.trim();
      
      if (dateStr && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          if (!scores[dateStr]) {
            scores[dateStr] = [];
          }
          scores[dateStr].push(score);
        }
      }
    }
    
    // Calculate average for each month
    const result: { [key: string]: string } = {};
    for (const [month, scoreArray] of Object.entries(scores)) {
      if (scoreArray.length > 0) {
        const avg = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
        result[month] = avg.toFixed(1);
      }
    }
    
    console.log(`✅ Found experience scores for ${teacherCode}:`, Object.keys(result).length, "months");
    return result;
  } catch (error) {
    console.error("Error fetching experience scores:", error);
    return {};
  }
}

// Helper function to parse CSV line with quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

export const GET = withApiProtection(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const emailParam = searchParams.get("email");
  
  // 🔒 LẤY TOKEN TỪ HEADER ĐỂ VERIFY
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!code && !emailParam) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp mã giáo viên hoặc email" },
      { status: 400 }
    );
  }

  if (!token) {
    return NextResponse.json(
      { error: "Unauthorized: Missing authentication token" },
      { status: 401 }
    );
  }

  // Verify token với Firebase để lấy email thực
  let verifiedEmail: string;
  let isAdmin = false;
  
  try {
    const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
    const verifyUrl = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`;
    
    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token })
    });

    if (!verifyResponse.ok) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid token" },
        { status: 401 }
      );
    }

    const verifyData = await verifyResponse.json();
    verifiedEmail = verifyData.users[0].email;

    // Check admin status từ sheet
    try {
      const adminCheckUrl = process.env.NEXT_PUBLIC_ADMIN_CHECK_URL;
      if (adminCheckUrl) {
        const adminResponse = await fetch(`${adminCheckUrl}?email=${encodeURIComponent(verifiedEmail)}`);
        const adminData = await adminResponse.json();
        isAdmin = adminData.isAdmin || false;
      }
    } catch (e) {
      // Nếu check admin fail, mặc định không phải admin
      isAdmin = false;
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Unauthorized: Token verification failed" },
      { status: 401 }
    );
  }

  // Fetch teachers từ Google Sheets
  const teachers = await fetchTeachersFromSheet();

  // Tìm học theo code hoặc email (fallback)
  let teacher: Teacher | undefined;

  if (code) {
    const searchCode = code.trim().toLowerCase();
    teacher = teachers.find(
      (t) => t.code.toLowerCase().trim() === searchCode
    );

    if (!teacher) {
      // Trả về danh sách mã có sẵn để debug
      const availableCodes = teachers.slice(0, 10).map(t => t.code).join(", ");
      return NextResponse.json(
        { 
          error: `Không tìm thấy giáo viên với mã "${code}". Một số mã có sẵn: ${availableCodes}...`,
          totalTeachers: teachers.length,
          sampleCodes: teachers.slice(0, 20).map(t => ({ code: t.code, name: t.name }))
        },
        { status: 404 }
      );
    }
  } else if (emailParam) {
    const normalizedEmail = emailParam.trim().toLowerCase();
    teacher = teachers.find(t =>
      (t.emailMindx || '').toLowerCase().trim() === normalizedEmail ||
      (t.emailPersonal || '').toLowerCase().trim() === normalizedEmail
    );

    if (!teacher) {
      return NextResponse.json(
        { error: `Không tìm thấy giáo viên với email "${emailParam}"` },
        { status: 404 }
      );
    }
  }

  // Ensure teacher is defined before continuing
  if (!teacher) {
    return NextResponse.json(
      { error: "Không tìm thấy giáo viên" },
      { status: 404 }
    );
  }

  // 🔒 BẢO MẬT: Kiểm tra quyền truy cập bằng EMAIL TỪ TOKEN
  // Admin: xem tất cả
  // User: chỉ xem được của chính mình
  if (!isAdmin) {
    const normalizedVerifiedEmail = verifiedEmail.toLowerCase().trim();
    const normalizedTeacherMindxEmail = teacher.emailMindx.toLowerCase().trim();
    const normalizedTeacherPersonalEmail = teacher.emailPersonal.toLowerCase().trim();
    
    // Kiểm tra email từ TOKEN có khớp với email của teacher không
    if (normalizedVerifiedEmail !== normalizedTeacherMindxEmail && 
        normalizedVerifiedEmail !== normalizedTeacherPersonalEmail) {
      return NextResponse.json(
        { error: "Forbidden: Bạn không có quyền xem thông tin của giáo viên khác" },
        { status: 403 }
      );
    }
  }

  // Fetch real monthly metrics từ Google Sheets
  const [expertiseScores, experienceScores] = await Promise.all([
    fetchExpertiseScores(teacher.code),
    fetchExperienceScores(teacher.code)
  ]);

  // Initialize với "3T" cho tất cả các tháng
  const months = ["1/2025", "2/2025", "3/2025", "4/2025", "5/2025", "6/2025", "7/2025", "8/2025", "9/2025", "10/2025", "11/2025", "12/2025"];
  
  teacher.monthlyMetrics = {
    expertise: {},
    experience: {}
  };

  // Set scores hoặc "3T" nếu không có dữ liệu
  months.forEach(month => {
    teacher.monthlyMetrics!.expertise[month] = expertiseScores[month] || "3T";
    teacher.monthlyMetrics!.experience[month] = experienceScores[month] || "3T";
  });

  return NextResponse.json({ teacher });
});
