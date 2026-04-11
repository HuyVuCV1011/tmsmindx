const fs = require('fs');
let code = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

const regex = /\{\/\* VÒNG TRÒN TIẾN TRÌNH \(LUÔN HIỆN\) \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\}\s*<\/UploadContext\.Provider>\s*\);\s*\};/m

let replacement = `{/* VÒNG TRÒN TIẾN TRÌNH (LUÔN HIỆN) */}
          <div className="relative w-14 h-14 bg-white dark:bg-slate-900 rounded-full shadow-xl flex items-center justify-center cursor-pointer border border-slate-100 dark:border-slate-800 hover:scale-105 transition-transform duration-200">
             {/* Vòng bg mờ */}
             <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
               <path
                 className="text-slate-100 dark:text-slate-800"
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="3.5"
               />
               <path
                 className={uploadState.progress === 100 ? "text-green-500 transition-all duration-500 ease-out" : "text-[#a1001f] transition-all duration-500 ease-out"}
                 strokeDasharray="100, 100"
                 strokeDashoffset={100 - uploadState.progress}
                 d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="3.5"
                 strokeLinecap="round"
               />
             </svg>
             {/* Icon bên trong */}
             {uploadState.progress === 100 ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 relative z-10" />
             ) : (
                <Upload className="w-5 h-5 text-[#a1001f] relative z-10 animate-pulse" />
             )}
          </div>
        </div>
      )}
    </UploadContext.Provider>
  );
};
`
code = code.replace(regex, replacement);
fs.writeFileSync('components/UploadVideoContext.tsx', code, 'utf8');
