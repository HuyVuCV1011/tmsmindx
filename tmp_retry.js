const fs = require('fs');
let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

// Thêm hàm lấy signature vào trước hook (có thể để ra ngoài hoặc ném thẳng lúc fetch)
const getSignatureCode = `
const getSignature = async () => {
    const res = await fetch("/api/cloudinary-signature", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder: "mindx_videos" }),
    });
    if (!res.ok) throw new Error("Không thể tạo signature");
    return res.json();
};

const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        console.warn(\`Tải lại lần \${i + 1} (Status: \${response.status})\`);
      } catch (err: any) {
        console.warn(\`Khẩn cấp tải lại mạng lần \${i + 1}: \${err.message}\`);
      }
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error("Lỗi đường truyền hoặc máy chủ quá tải (đã thử nhiều lần).");
};
`;

content = content.replace('export const UploadVideoProvider', getSignatureCode + '\nexport const UploadVideoProvider');

// Sửa lại logic trong startUpload
content = content.replace(
    /\/\/ Step 1: Get signature from our API[\s\S]*?const { signature, timestamp, cloudName, apiKey, folder } = await signatureRes\.json\(\);/,
    '// Lấy signature khởi tạo (chỉ để lấy cloudName, v.v.)\n      const { cloudName, apiKey, folder } = await getSignature();'
);

content = content.replace(
    /const uploadRes = await fetch\(\s*\`https\:\/\/api\.cloudinary\.com\/v1_1\/\$\{cloudName\}\/video\/upload\`,\s*\{\s*method\: "POST",\s*body\: formData,\s*\}\s*\);/g,
    'const uploadRes = await fetchWithRetry(\n`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,\n{ method: "POST", body: formData }, 5); // Thử lại 5 lần nếu rớt mạng'
);


content = content.replace(
    /await fetch\("\/api\/training-videos",\s*\{\s*method\: "POST",\s*headers\: \{ "Content-Type"\: "application\/json" \},\s*body\: JSON\.stringify\(/g,
    'await fetchWithRetry("/api/training-videos", {\nmethod: "POST",\nheaders: { "Content-Type": "application/json" },\nbody: JSON.stringify('
);


fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');
