import { NextResponse } from 'next/server';

export async function GET() {
  // Template CSV content
  const csvContent = `question_text,question_type,correct_answer,options,points,difficulty,explanation,image_url
"Python là ngôn ngữ lập trình gì?",multiple_choice,"Ngôn ngữ thông dịch","Ngôn ngữ thông dịch|Ngôn ngữ biên dịch|Ngôn ngữ máy|Ngôn ngữ assembly",1,easy,"Python là ngôn ngữ lập trình bậc cao, thông dịch và hướng đối tượng",
"JavaScript chỉ chạy được trên trình duyệt web",true_false,"Sai","Đúng|Sai",1,medium,"JavaScript có thể chạy trên cả server-side (Node.js) và client-side (trình duyệt)",
"Kể tên 3 nguyên tắc cơ bản của OOP",short_answer,"Encapsulation, Inheritance, Polymorphism",,2,medium,"Ba nguyên tắc cơ bản: Đóng gói (Encapsulation), Kế thừa (Inheritance), Đa hình (Polymorphism)",
"Giải thích khái niệm async/await trong JavaScript",essay,,,5,hard,"Async/await là cú pháp giúp làm việc với Promise dễ dàng hơn",
"Câu lệnh nào dùng để khai báo biến trong JavaScript ES6?",multiple_choice,"let","var|let|define|dim",1,easy,"ES6 giới thiệu let và const để khai báo biến",
"HTML là ngôn ngữ lập trình",true_false,"Sai","Đúng|Sai",1,easy,"HTML là ngôn ngữ đánh dấu (markup language), không phải ngôn ngữ lập trình",
"CSS là viết tắt của gì?",short_answer,"Cascading Style Sheets",,1,easy,"CSS (Cascading Style Sheets) là ngôn ngữ định dạng giao diện",
"So sánh SQL và NoSQL",essay,,,3,medium,"SQL: cơ sở dữ liệu quan hệ, có cấu trúc cứng. NoSQL: linh hoạt hơn, phù hợp với dữ liệu phi cấu trúc",
`;

  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF';
  const csvWithBom = bom + csvContent;

  return new NextResponse(csvWithBom, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="mau_cau_hoi_bai_tap.csv"',
    },
  });
}
