import { v2 as cloudinary } from "cloudinary";
import { NextRequest, NextResponse } from "next/server";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get("image");
    
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Không tìm thấy file" }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File phải là hình ảnh" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Kích thước file không được vượt quá 5MB" }, { status: 400 });
    }

    // Đọc file thành buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload lên Cloudinary bằng upload_stream
    return await new Promise<Response>((resolve) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          resource_type: "image", 
          folder: "mindx_question_images",
          transformation: [
            { width: 800, height: 600, crop: "limit" },
            { quality: "auto" }
          ]
        },
        (error, result) => {
          if (error || !result) {
            console.error("Cloudinary upload error:", error);
            resolve(NextResponse.json({ 
              error: "Lỗi upload ảnh lên cloud. Vui lòng thử lại." 
            }, { status: 500 }));
          } else {
            resolve(
              NextResponse.json({
                success: true,
                url: result.secure_url,
                public_id: result.public_id,
                width: result.width,
                height: result.height,
              })
            );
          }
        }
      );
      stream.end(buffer);
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ 
      error: "Lỗi server khi upload ảnh" 
    }, { status: 500 });
  }
}
