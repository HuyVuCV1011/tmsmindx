import { NextRequest, NextResponse } from "next/server";

const SHEET_ID = "1U2od4wWLYPJGTZacWRBlAnDF12SAbDFhDfGlBYw3DzI";
const GID = "0";

interface TestRecord {
  area: string;
  name: string;
  email: string;
  subject: string;
  branch: string;
  code: string;
  type: string;
  month: string;
  year: string;
  batch: string;
  time: string;
  exam: string;
  correct: string;
  score: string;
  emailExplanation: string;
  processing: string;
  date: string;
  isCountedInAverage: boolean;
}

interface MonthlyAverage {
  month: string;
  average: number;
  count: number;
  records: TestRecord[];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Mã giáo viên là bắt buộc" }, { status: 400 });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
    const response = await fetch(url);
    const csvText = await response.text();

    const lines = csvText.split("\n");
    const records: TestRecord[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns: string[] = [];
      let currentColumn = "";
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          columns.push(currentColumn);
          currentColumn = "";
        } else {
          currentColumn += char;
        }
      }
      columns.push(currentColumn);

      const teacherCode = columns[5]?.trim().toLowerCase();
      if (teacherCode !== code.toLowerCase()) continue;

      const score = parseFloat(columns[13]?.replace(",", ".") || "0");
      const emailExplanation = columns[14]?.trim() || "";
      
      let dateStr = columns[16]?.trim();
      if (!dateStr && columns[7] && columns[8]) {
        dateStr = `${columns[7]}/${columns[8]}`;
      }

      const isCountedInAverage = !(score === 0 && emailExplanation === "Đã email giải trình");

      const record: TestRecord = {
        area: columns[0]?.trim() || "",
        name: columns[1]?.trim() || "",
        email: columns[2]?.trim() || "",
        subject: columns[3]?.trim() || "",
        branch: columns[4]?.trim() || "",
        code: columns[5]?.trim() || "",
        type: columns[6]?.trim() || "",
        month: columns[7]?.trim() || "",
        year: columns[8]?.trim() || "",
        batch: columns[9]?.trim() || "",
        time: columns[10]?.trim() || "",
        exam: columns[11]?.trim() || "",
        correct: columns[12]?.trim() || "",
        score: columns[13]?.trim() || "0",
        emailExplanation: emailExplanation,
        processing: columns[15]?.trim() || "",
        date: dateStr || "",
        isCountedInAverage: isCountedInAverage,
      };

      records.push(record);
    }

    records.sort((a, b) => {
      const yearA = parseInt(a.year) || 0;
      const yearB = parseInt(b.year) || 0;
      if (yearA !== yearB) return yearB - yearA;
      
      const monthA = parseInt(a.month) || 0;
      const monthB = parseInt(b.month) || 0;
      return monthB - monthA;
    });

    const monthlyMap = new Map<string, TestRecord[]>();
    records.forEach((record) => {
      if (!monthlyMap.has(record.date)) {
        monthlyMap.set(record.date, []);
      }
      monthlyMap.get(record.date)!.push(record);
    });

    const monthlyData: MonthlyAverage[] = [];
    monthlyMap.forEach((monthRecords, month) => {
      const countedRecords = monthRecords.filter((r) => r.isCountedInAverage);
      if (countedRecords.length > 0) {
        const sum = countedRecords.reduce((acc, r) => {
          return acc + parseFloat(r.score.replace(",", "."));
        }, 0);
        const average = sum / countedRecords.length;
        monthlyData.push({
          month: month,
          average: average,
          count: countedRecords.length,
          records: monthRecords,
        });
      } else {
        monthlyData.push({
          month: month,
          average: 0,
          count: 0,
          records: monthRecords,
        });
      }
    });

    monthlyData.sort((a, b) => {
      const [monthA, yearA] = a.month.split("/").map(Number);
      const [monthB, yearB] = b.month.split("/").map(Number);
      if (yearA !== yearB) return yearB - yearA;
      return monthB - monthA;
    });

    return NextResponse.json({
      records: records,
      monthlyData: monthlyData,
      totalRecords: records.length,
      teacherCode: code,
    });
  } catch (error) {
    console.error("Error fetching raw data:", error);
    return NextResponse.json(
      { error: "Lỗi khi lấy dữ liệu từ Google Sheets" },
      { status: 500 }
    );
  }
}
