const fs = require('fs');

function patchFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const rep of replacements) {
    if (content.includes(rep.search)) {
      content = content.replace(rep.search, rep.replace);
    } else {
      console.warn(`Could not find snippet in ${filePath}:\n${rep.search}\n`);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

// 1. page.tsx
patchFile('app/user/truyenthong/page.tsx', [
  {
    search: '<div className="max-w-7xl mx-auto px-1 md:px-2 py-8">',
    replace: '<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">'
  },
  {
    search: '<div className="max-w-7xl mx-auto px-1 md:px-2 pt-8 pb-8 space-y-12">',
    replace: '<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-12">'
  },
  {
    search: 'top-20 z-30 bg-white/80 backdrop-blur-xl border border-gray-200/50 p-2 rounded-2xl shadow-sm',
    replace: 'top-20 z-30 bg-white/95 backdrop-blur-sm border border-gray-200/50 p-2 rounded-2xl shadow-sm'
  },
  {
    search: 'px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap',
    replace: 'px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 whitespace-nowrap'
  },
  {
    search: '<div className="flex flex-col gap-8">',
    replace: '<div className="flex flex-col gap-6 md:gap-8">'
  }
]);

// 2. slider.tsx
patchFile('components/slider.tsx', [
  {
    search: 'className={cn(\n                            "absolute inset-0 transition-all duration-1000 ease-in-out will-change-transform transform",\n                            index === currentSlide ? \'opacity-100 scale-100 z-10\' : \'opacity-0 scale-110 z-0\'\n                        )}',
    replace: 'className={cn(\n                            "absolute inset-0 transition-all duration-1000 ease-in-out transform",\n                            index === currentSlide ? \'opacity-100 scale-100 z-10 will-change-transform\' : \'opacity-0 scale-[1.05] z-0 pointer-events-none\'\n                        )}'
  },
  {
    search: '<Image\n                            src={post.banner_image || "/placeholder-banner.jpg"}\n                            alt={post.title}\n                            fill\n                            className="object-cover"\n                            priority={index === 0}\n                        />',
    replace: '<Image\n                            src={post.banner_image || "/placeholder-banner.jpg"}\n                            alt={post.title}\n                            fill\n                            className="object-cover"\n                            priority={index === 0}\n                            sizes="100vw"\n                        />'
  },
  {
    search: 'p-4 rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black transition-all hover:scale-110 active:scale-95 group',
    replace: 'p-4 rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-sm hover:bg-white hover:text-black transition-all active:scale-95 group'
  },
  {
    search: 'shadow-[0_20px_60px_-30px_rgba(0,0,0,0.6)]',
    replace: 'shadow-2xl'
  },
  {
     search: 'drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]',
     replace: 'drop-shadow-lg'
  },
  {
      search: 'shadow-[0_10px_30px_rgba(0,0,0,0.35)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.45)] transition-all duration-300 hover:-translate-y-1',
      replace: 'shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5'
  }
]);

// 3. post-card.tsx
patchFile('components/post-card.tsx', [
  {
    search: '<Image\n                        src={post.featured_image || "/placeholder.svg"}\n                        alt={post.title}\n                        fill\n                        className={cn(\n                            "object-cover transition-transform duration-700 ease-out",\n                            isHovered ? "scale-105" : "scale-100"\n                        )}\n                        loading="lazy"\n                    />',
    replace: '<Image\n                        src={post.featured_image || "/placeholder.svg"}\n                        alt={post.title}\n                        fill\n                        className={cn(\n                            "object-cover transition-transform duration-700 ease-out",\n                            isHovered ? "scale-105" : "scale-100"\n                        )}\n                        loading="lazy"\n                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"\n                    />'
  },
  {
     search: 'hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]',
     replace: 'hover:shadow-xl'
  }
]);

// 4. upcoming-events-sidebar.tsx
patchFile('components/upcoming-events-sidebar.tsx', [
  {
    search: 'bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-shadow duration-300',
    replace: 'bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300'
  },
  {
    search: 'bg-linear-to-br from-red-800 via-red-900 to-rose-900 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(153,27,27,0.45)] hover:shadow-[0_12px_40px_rgba(153,27,27,0.55)] transition-all duration-300 hover:scale-[1.02]',
    replace: 'bg-linear-to-br from-red-800 via-red-900 to-rose-900 rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300'
  },
  {
    search: 'bg-linear-to-r from-red-700/50 to-transparent backdrop-blur-sm',
    replace: 'bg-linear-to-r from-red-700/50 to-transparent'
  },
  {
    search: 'bg-white/5 hover:bg-white/15 border-white/10 hover:border-white/25',
    replace: 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-white/20'
  },
  {
    search: 'w-full py-3 bg-white/15 hover:bg-white text-white hover:text-red-700 text-sm font-bold rounded-xl transition-all duration-200 border border-white/30 hover:border-white shadow-lg hover:shadow-xl backdrop-blur-sm group',
    replace: 'w-full py-3 bg-white/15 hover:bg-white text-white hover:text-red-700 text-sm font-bold rounded-xl transition-colors duration-200 border border-white/30 hover:border-white shadow-sm hover:shadow-md group'
  }
]);

console.log("Patching complete");
