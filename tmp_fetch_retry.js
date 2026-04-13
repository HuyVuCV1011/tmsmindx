const fs = require('fs');
let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

const oldFetch = `const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
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
};`;

const newFetch = `const fetchWithRetry = async (url: string, options: any, maxRetries = 3) => {
    let lastErrorDetails = "";
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        const errorText = await response.text();
        lastErrorDetails = \`Status \${response.status}: \${errorText}\`;
        console.warn(\`Tải lại lần \${i + 1} (\${lastErrorDetails})\`);
        
        // NẾU LỖI 400 (BAD REQUEST) TỪ CLOUDINARY HOẶC API -> THƯỜNG LÀ LỖI DỮ LIỆU/CHỮ KÍ, DỪNG LUÔN KHÔNG RETRY CHO TIẾT KIỆM THỜI GIAN
        if (response.status === 400) {
            throw new Error(\`Lỗi dữ liệu (400): \${errorText}\`);
        }
      } catch (err: any) {
        console.warn(\`Khẩn cấp tải lại mạng lần \${i + 1}: \${err.message}\`);
        lastErrorDetails = err.message;
        if (err.message.includes("Lỗi dữ liệu (400)")) throw err;
      }
      if (i < maxRetries - 1) await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error(\`Lỗi đường truyền hoặc máy chủ quá tải. Chi tiết: \${lastErrorDetails}\`);
};`;

content = content.replace(oldFetch, newFetch);

// Dọn dẹp mem: ffmpeg.deleteFile(filename);
content = content.replace(
  /const uploadData = await uploadRes\.json\(\);/,
  `const uploadData = await uploadRes.json();
          // Dọn dẹp memory ngay để tránh tràn RAM trình duyệt
          try { await ffmpeg.deleteFile(filename); } catch (e) {}
`
);

// Xóa input.mp4 khi xong
content = content.replace(
  /isSuccess = true;/,
  `isSuccess = true;
        try { await ffmpeg.deleteFile("input.mp4"); } catch (e) {}`
);

fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');
