const fs = require('fs');
const content = fs.readFileSync('app/admin/page5/page.tsx', 'utf8');

const regex = /const handleFileChange = async[\s\S]*?(?=const groupedVideos)/m;

const newString = `const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await startUpload(file);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  `;

fs.writeFileSync('app/admin/page5/page.tsx', content.replace(regex, newString), 'utf8');
