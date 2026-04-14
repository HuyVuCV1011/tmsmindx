import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get("image");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  // Đọc file thành buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload lên Cloudinary bằng upload_stream
  return await new Promise<Response>((resolve) => {
    const stream = cloudinary.uploader.upload_stream(
      { 
        resource_type: "image", 
        folder: "mindx_thumbnails",
        // Không crop ảnh — giữ nguyên ảnh gốc để admin có thể chỉnh vùng crop sau
        transformation: [
          { quality: "auto" },
          { fetch_format: "auto" }
        ]
      },
      (error, result) => {
        if (error || !result) {
          resolve(NextResponse.json({ error: "Cloudinary upload failed" }, { status: 500 }));
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
}
