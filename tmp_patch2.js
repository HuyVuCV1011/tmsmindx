const fs = require('fs');
let content = fs.readFileSync('app/admin/page5/page.tsx', 'utf8');

content = content.replace(/disabled=\{uploading\}/g, "disabled={uploadState.isUploading}");
content = content.replace(/\{uploading \? "Đang tải lên\.\.\." \: "Upload video"\}/g, "{uploadState.isUploading ? \"Đang tải lên...\" : \"Upload video\"}");
content = content.replace(/\{uploading && \([\s\S]*?\)\}/g, "");

fs.writeFileSync('app/admin/page5/page.tsx', content, 'utf8');
