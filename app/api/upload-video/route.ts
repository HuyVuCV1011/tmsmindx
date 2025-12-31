import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("video");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  // Đọc file thành buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Upload lên Cloudinary bằng upload_stream
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { resource_type: "video", folder: "mindx_videos" },
      (error, result) => {
        if (error || !result) {
          resolve(NextResponse.json({ error: "Cloudinary upload failed" }, { status: 500 }));
        } else {
          resolve(
            NextResponse.json({
              success: true,
              url: result.secure_url,
              public_id: result.public_id,
              duration: result.duration,
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