import { NextRequest, NextResponse } from "next/server";

const SHEET_ID = "1_sHOkQC_10z288bocQWVxPAZNYl9d8jO4sG0UfPMw-g";
const GID_PROFILE = "2024010042"; // Teacher profile sheet
const GID_EXPERTISE = "1572906341"; // Data Total [Chuyên sâu] 2025
const GID_EXPERIENCE = "1628626585"; // Data Total [Trải nghiệm] 2025

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

// Fetch data từ Google Sheets
async function fetchTeachersFromSheet(): Promise<Teacher[]> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_PROFILE}`;
    const response = await fetch(csvUrl, { 
      next: { revalidate: 300 } // Cache 5 phút
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

    return teachers.filter(t => t.code); // Chỉ lấy những dòng có code
  } catch (error) {
    console.error("Error fetching from Google Sheets:", error);
    return [];
  }
}

// Fetch expertise scores (Chuyên sâu)
// Formula: =IFERROR(AVERAGEIFS($AH:$AH, $Z:$Z, $B$3, $AK:$AK, F$10), "3T")
// $AH:$AH (col 34, index 33) = Điểm
// $Z:$Z (col 26, index 25) = Mã LMS
// $AK:$AK (col 37, index 36) = Date
async function fetchExpertiseScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_EXPERTISE}`;
    console.log("Fetching expertise from:", csvUrl);
    const response = await fetch(csvUrl, { 
      next: { revalidate: 300 }
    });
    
    if (!response.ok) {
      console.error("Expertise fetch failed. Status:", response.status, "URL:", csvUrl);
      throw new Error(`Cannot fetch expertise data. Status: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    let debugCount = 0;
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      // Based on AVERAGEIFS formula:
      // Column Z (index 25) = Mã LMS
      // Column AH (index 33) = Điểm
      // Column AK (index 36) = Date
      const code = columns[25]?.trim().toLowerCase();
      const scoreStr = columns[33]?.replace(",", ".").trim();
      const dateStr = columns[36]?.trim();
      
      // Debug first few matches
      if (code === teacherCode.toLowerCase() && debugCount < 3) {
        console.log(`[Expertise Debug ${debugCount}] Code: ${code}, Score: ${scoreStr}, Date: ${dateStr}`);
        debugCount++;
      }
      
      if (code === teacherCode.toLowerCase() && dateStr && scoreStr) {
        const score = parseFloat(scoreStr);
        if (!isNaN(score)) {
          if (!scores[dateStr]) {
            scores[dateStr] = [];
          }
          scores[dateStr].push(score);
        }
      }
    }
    
    console.log(`[Expertise Summary] Found ${Object.keys(scores).length} months with data for ${teacherCode}:`, scores);
    
    // Calculate average for each month and normalize date format
    const result: { [key: string]: string } = {};
    for (const [month, scoreArray] of Object.entries(scores)) {
      if (scoreArray.length > 0) {
        const avg = scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
        // Normalize date format: remove leading zeros (02/2025 -> 2/2025)
        const normalizedMonth = month.replace(/^0(\d)\//, '$1/');
        result[normalizedMonth] = avg.toFixed(1);
      }
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching expertise scores:", error);
    return {};
  }
}

// Fetch experience scores (Trải nghiệm)
// Formula: =IFERROR(AVERAGEIFS($M:$M, $E:$E, $B$3, $P:$P, F$10), "3T")
// $M:$M (col 13, index 12) = Điểm
// $E:$E (col 5, index 4) = Mã LMS
// $P:$P (col 16, index 15) = Date
async function fetchExperienceScores(teacherCode: string): Promise<{ [key: string]: string }> {
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID_EXPERIENCE}`;
    console.log("Fetching experience from:", csvUrl);
    const response = await fetch(csvUrl, { 
      next: { revalidate: 300 }
    });
    
    if (!response.ok) {
      console.error("Experience fetch failed. Status:", response.status, "URL:", csvUrl);
      throw new Error(`Cannot fetch experience data. Status: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.split("\n");
    const dataLines = lines.slice(1).filter(line => line.trim());
    
    const scores: { [key: string]: number[] } = {};
    
    for (const line of dataLines) {
      const columns = parseCSVLine(line);
      
      // Based on AVERAGEIFS formula:
      // Column E (index 4) = Mã LMS
      // Column M (index 12) = Điểm
      // Column P (index 15) = Date
      const code = columns[4]?.trim().toLowerCase();
      const scoreStr = columns[12]?.replace(",", ".").trim();
      const dateStr = columns[15]?.trim();
      
      if (code === teacherCode.toLowerCase() && dateStr && scoreStr) {
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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp mã giáo viên" },
      { status: 400 }
    );
  }

  // Fetch teachers từ Google Sheets
  const teachers = await fetchTeachersFromSheet();

  // Tìm kiếm không phân biệt hoa thường và loại bỏ khoảng trắng
  const searchCode = code.trim().toLowerCase();
  const teacher = teachers.find(
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
}
