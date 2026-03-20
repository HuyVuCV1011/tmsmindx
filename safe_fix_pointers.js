const fs = require('fs');
const glob = require('glob');

function fixFiles() {
  const files = glob.sync('app/**/*.tsx');
  let totalFixed = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Use regex to find `className="something"` that follows or precedes onClick within <div or <span or <td or <tr
    // We'll just replace `className="` with `className="cursor-pointer ` if the block has onClick
    // Actually, let's target specific lines where onClick occurs.

    let lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.match(/<\s*(div|span|tr|td|li)/) && line.includes('onClick=') && !line.includes('cursor-pointer')) {
            if (line.includes('className="')) {
                lines[i] = line.replace('className="', 'className="cursor-pointer ');
            } else if (line.includes("className={'")) {
                lines[i] = line.replace("className={'", "className={'cursor-pointer ");
            } else if (line.includes("className={`")) {
                lines[i] = line.replace("className={`", "className={`cursor-pointer ");
            } else if (!line.includes("className=")) {
                lines[i] = line.replace('onClick=', 'className="cursor-pointer" onClick=');
            }
        }
    }

    content = lines.join('\n');
    if (content !== original) {
       fs.writeFileSync(file, content);
       totalFixed++;
    }
  });
  console.log(`Fixed missing cursor pointers safely in ${totalFixed} files.`);
}

fixFiles();
