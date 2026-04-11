const fs = require('fs');

let content = fs.readFileSync('components/UploadVideoContext.tsx', 'utf8');

// 1. Sửa Title bỏ "(Phần X)" đi khi upload dạng chunk
const oldTitle = /\`\$\{file\.name\.replace\(\/\\\\\.\[\^\/\.\]\+\$\/, ""\)\} \(Phần \$\{i \+ 1\}\)\`/;
content = content.replace(oldTitle, 'file.name.replace(/\\.[^/.]+$/, "")');

// 2. Chuyển đổi component UI
const oldUIBlock = /<div className="fixed bottom-6 right-6 z-\[9999\] w-80 lg:w-96 bg-white[\s\S]*?<\/div>[\s]*<\/div>[\s]*<\/div>/;

const newUIBlock = `<div className="fixed bottom-6 right-6 z-[9999] group flex flex-col items-end gap-3 transform transition-all duration-300">
          
          {/* TRẠNG THÁI (HIỆN KHI HOVER) */}
          <div className="hidden group-hover:flex flex-col w-80 bg-white dark:bg-slate-900 shadow-2xl rounded-2xl p-4 border border-slate-100 dark:border-slate-800 ring-1 ring-black/5 origin-bottom-right animate-in zoom-in-95 duration-200">
             <div className="flex items-start gap-3">
                 <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <h4 className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate pr-2 w-[80%]" title={uploadState.originalFilename}>
                        {uploadState.originalFilename}
                      </h4>
                      <span className="text-xs font-black text-[#a1001f]">
                        {uploadState.progress}%
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate w-full" title={uploadState.statusText}>
                      {uploadState.statusText}
                    </p>

                    <div className="flex items-center gap-2 mt-2 bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300">
                        {uploadState.progress === 100 ? (
                           <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                        ) : (
                           <Loader2 className="w-3.5 h-3.5 text-[#a1001f] animate-spin" />
                        )}
                        <span className="font-medium">
                          {uploadState.progress === 100 ? 'Hoàn tất tải lên' : 'Đang xử lý ngầm (Đừng F5/Tắt tab)'}
                        </span>
                    </div>
                 </div>
             </div>
          </div>

          {/* VÒNG TRÒN TIẾN TRÌNH (LUÔN HIỆN) */}
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
        </div>`;

content = content.replace(oldUIBlock, newUIBlock);

fs.writeFileSync('components/UploadVideoContext.tsx', content, 'utf8');
