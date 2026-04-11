const fs = require('fs');
let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

// Update fetchWithRetry to crash loudly on typical 4xx errors to avoid waiting and hiding issues
const oldRetryBlock = `if (response.status === 400) {
            throw new Error(\`Lỗi dữ liệu (400): \${errorText}\`);
        }`;
const newRetryBlock = `if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
            throw new Error(\`Máy chủ từ chối (Status \${response.status}): \${errorText}\`);
        }`;
content = content.replace(oldRetryBlock, newRetryBlock);

content = content.replace(/if \(err\.message\.includes\("Lỗi dữ liệu \(400\)"\)\)/g, 'if (err.message.includes("Máy chủ từ chối"))');

// Update CHUNK_LIMIT_MB from 90 to 45 to protect against Cloudinary 100MB hard limit and keyframe drifting
content = content.replace(/const CHUNK_LIMIT_MB = 90;/g, 'const CHUNK_LIMIT_MB = 45;'); // An toàn tuyệt đối

fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');
