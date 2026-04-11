const fs = require('fs');
let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

content = content.replace(/formData\.append\("file", chunkBlob, \`\$\{file\.name\}_part\$\{i \+ 1\}\.mp4\`\);/, 
    'formData.append("file", chunkBlob, `${file.name}_part${i + 1}.mp4`);\n' + 
    '          const { signature, timestamp } = await getSignature(); // Làm mới signature để không bị hết hạn 1 giờ trong quá trình cắt video lâu\n'
);

content = content.replace(/formData\.append\("file", file\);/, 
    'formData.append("file", file);\n' + 
    '        const { signature, timestamp } = await getSignature();\n'
);

fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');
