const fs = require('fs');
let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

const oldIter = `const groupId = uuidv4();

        for (let i = 0; i < numChunks; i++) {
          const filename = \`output_\${i.toString().padStart(3, "0")}.mp4\`;`;

const newIter = `const groupId = uuidv4();

        // FFmpeg chạy xong, đếm CHÍNH XÁC bao nhiêu file output được tạo ra (tránh lỗi keyframe cắt dư/thiếu)
        const dirList = await ffmpeg.listDir("/");
        const outputFiles = dirList.filter(f => f.name.startsWith("output_") && f.name.endsWith(".mp4")).map(f => f.name).sort();
        const actualNumChunks = outputFiles.length;

        for (let i = 0; i < actualNumChunks; i++) {
          const filename = outputFiles[i];`;

const oldStatusTexts = [
    `statusText: \`Đang tải lên mảnh \${i + 1}/\${numChunks}...\`,`,
    `chunk_total: numChunks,`
];

content = content.replace(oldIter, newIter);
content = content.replace(/numChunks/g, 'actualNumChunks'); // Đổi toàn bộ các tham chiếu bên dưới loop

// Nhưng đoạn trên lúc ước tính (ước tính numChunks cắt) thì vẫn giữ, ta phải phân biệt:
const oldCalc = `const numChunks = Math.ceil(fileMB / CHUNK_LIMIT_MB);
        const segmentTime = Math.ceil(durationSec / numChunks);

        setUploadState((prev) => ({ ...prev, statusText: \`Đang cắt thành \${numChunks} mảnh...\` }));`;

const newCalc = `const estimatedChunks = Math.ceil(fileMB / CHUNK_LIMIT_MB);
        // Thêm 2 giây dư dả để chắc chắn cover hết keyframe, hạn chế phát sinh nhiều mảnh vụn ở chu trình cuối
        const segmentTime = Math.ceil(durationSec / estimatedChunks) + 2; 

        setUploadState((prev) => ({ ...prev, statusText: \`Đang cắt thành khoảng \${estimatedChunks} mảnh...\` }));`;

// Now we need to manually fix the specific lines
content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

// Phục hồi lại state logic 
const theCalcBlock = /const numChunks = Math\.ceil\(fileMB \/ CHUNK_LIMIT_MB\);\s*const segmentTime = Math\.ceil\(durationSec \/ numChunks\);\s*setUploadState\(\(prev\) => \(\{ \.\.\.prev, statusText\: \`Đang cắt thành \$\{numChunks\} mảnh\.\.\.\` \}\)\);/;

content = content.replace(theCalcBlock, 
`const estimatedChunks = Math.ceil(fileMB / CHUNK_LIMIT_MB);
        const segmentTime = Math.ceil(durationSec / estimatedChunks) + 2;

        setUploadState((prev) => ({ ...prev, statusText: \`Đang phân rã dữ liệu... (Tùy máy sẽ mất vài phút)\` }));`);

// Thay thế block The Loop
const theLoopBlock = /const groupId = uuidv4\(\);\s*for \(let i = 0; i < numChunks; i\+\+\) \{\s*const filename = \`output_\$\{i\.toString\(\)\.padStart\(3, "0"\)\}\.mp4\`;/;

content = content.replace(theLoopBlock,
`const groupId = uuidv4();

        // Đếm chính xác số phận cắt được sinh ra
        const dirList = await ffmpeg.listDir('/');
        const outputFiles = dirList.filter(f => f.name && f.name.startsWith('output_') && f.name.endsWith('.mp4')).map(f => f.name).sort();
        const actualNumChunks = outputFiles.length;

        for (let i = 0; i < actualNumChunks; i++) {
          const filename = outputFiles[i];`);

// Ở trong loop có dùng numChunks -> phải thay thành actualNumChunks
const progressRule = /const baseUploadProgress = 30 \+ \(i \/ numChunks\) \* 70;/;
content = content.replace(progressRule, 'const baseUploadProgress = 30 + (i / actualNumChunks) * 70;');

const statusTextRule = /statusText\: \`Đang tải lên mảnh \$\{i \+ 1\}\/\$\{numChunks\}\.\.\.\`,/;
content = content.replace(statusTextRule, 'statusText: `Đang tải lên mảnh ${i + 1}/${actualNumChunks}...`,');

const chunkTotalRule = /chunk_total\: numChunks,/;
content = content.replace(chunkTotalRule, 'chunk_total: actualNumChunks,');

fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');

