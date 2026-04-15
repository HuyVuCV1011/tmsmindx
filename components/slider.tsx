'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState, useCallback } from 'react'

interface Post {
    id: string | number
    title: string
    description: string
    featured_image?: string
    banner_image: string
    post_type: string
    slug?: string
}

interface SliderProps {
    posts: Post[]
}

const POST_TYPE_LABELS: Record<string, string> = {
    'tin-tức': 'Tin tức',
    'chính-sách': 'Chính sách',
    'sự-kiện': 'Sự kiện',
    'đào-tạo': 'Đào tạo',
    'báo-cáo': 'Báo cáo',
    'thông-báo': 'Thông báo',
}

export default function Slider({ posts }: SliderProps) {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [autoPlay, setAutoPlay] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)

    const handleSlideChange = useCallback((newIndex: number) => {
        if (isTransitioning) return
        setIsTransitioning(true)
        setCurrentSlide(newIndex)
        setTimeout(() => setIsTransitioning(false), 800)
    }, [isTransitioning])

    useEffect(() => {
        if (!autoPlay || posts.length <= 1) return
        const timer = setInterval(() => {
            handleSlideChange((currentSlide + 1) % posts.length)
        }, 6000)
        return () => clearInterval(timer)
    }, [autoPlay, posts.length, currentSlide, handleSlideChange])

    const goToPrevious = () => { handleSlideChange((currentSlide - 1 + posts.length) % posts.length); setAutoPlay(false) }
    const goToNext    = () => { handleSlideChange((currentSlide + 1) % posts.length); setAutoPlay(false) }
    const goToSlide   = (i: number) => { if (i !== currentSlide) { handleSlideChange(i); setAutoPlay(false) } }

    if (!posts.length) return null

    return (
        <div
            className="relative w-full h-72 sm:h-96 md:h-[480px] lg:h-[560px] rounded-2xl overflow-hidden bg-gray-900 group shadow-xl ring-1 ring-black/5"
            onMouseEnter={() => setAutoPlay(false)}
            onMouseLeave={() => setAutoPlay(true)}
        >
            {posts.map((post, index) => (
                <div
                    key={post.id}
                    className={cn(
                        "absolute inset-0 transition-opacity duration-700 ease-in-out",
                        index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                    )}
                >
                    {/* Image — blur nhẹ để tăng depth */}
                    <div className="absolute inset-0">
                        <Image
                            src={post.banner_image || post.featured_image || "/placeholder-banner.jpg"}
                            alt={post.title}
                            fill
                            className="object-cover object-center scale-105"
                            style={{ filter: 'blur(6px)' }}
                            priority={index === 0}
                            quality={95}
                            sizes="(max-width: 768px) 100vw, 1920px"
                        />
                    </div>

                    {/* Double gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/10 to-transparent" />

                    {/* Content — bottom-left, không card */}
                    <div className={cn(
                        "absolute bottom-0 left-0 right-0 p-5 sm:p-8 md:p-12 lg:p-14 transform transition-all duration-700 delay-200",
                        index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                    )}>
                        {/* Tag */}
                        <div className="mb-3">
                            <span className="inline-block px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-widest uppercase bg-white/15 text-white border border-white/25">
                                {POST_TYPE_LABELS[post.post_type] || post.post_type}
                            </span>
                        </div>

                        {/* Title */}
                        <h3
                            className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black leading-tight tracking-tight text-white max-w-2xl"
                            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.9)' }}
                        >
                            <Link href={`/user/truyenthong/${post.slug || post.id}`} className="hover:text-white/90 transition-colors">
                                {post.title}
                            </Link>
                        </h3>

                        {/* Description */}
                        <p
                            className="mt-2 text-sm sm:text-base text-white/80 line-clamp-2 max-w-xl leading-relaxed hidden sm:block"
                            style={{ textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}
                        >
                            {post.description}
                        </p>

                        {/* CTA */}
                        <div className="mt-4 sm:mt-5">
                            <Link href={`/user/truyenthong/${post.slug || post.id}`}>
                                <Button
                                    size="lg"
                                    className="bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-full px-6 sm:px-8 py-4 sm:py-6 text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                                >
                                    Đọc ngay
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            ))}

            {/* Arrows + Dots — cùng hàng, bottom-right, không đè content */}
            <div className="absolute bottom-5 right-5 z-20 flex items-center gap-3">
                {/* Dots */}
                <div className="flex items-center gap-2">
                    {posts.map((_, index) => (
                        <button key={index} onClick={() => goToSlide(index)} className="group py-1.5" aria-label={`Slide ${index + 1}`}>
                            <span className={cn(
                                "block h-1 rounded-full transition-all duration-500",
                                index === currentSlide ? "w-8 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]" : "w-1.5 bg-white/40 group-hover:bg-white/60"
                            )} />
                        </button>
                    ))}
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-white/20" />

                {/* Arrows */}
                <div className="flex items-center gap-1.5">
                    <button onClick={goToPrevious} className="w-8 h-8 rounded-full border border-white/20 bg-black/30 text-white hover:bg-white hover:text-black transition-all active:scale-90 flex items-center justify-center" aria-label="Previous">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={goToNext} className="w-8 h-8 rounded-full border border-white/20 bg-black/30 text-white hover:bg-white hover:text-black transition-all active:scale-90 flex items-center justify-center" aria-label="Next">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Progress bar — CSS keyframes để reset đúng khi đổi slide */}
            {autoPlay && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-20">
                    <div
                        key={currentSlide}
                        className="h-full bg-white/60"
                        style={{ animation: 'sliderProgress 6s linear forwards' }}
                    />
                </div>
            )}

            <style jsx>{`
                @keyframes sliderProgress {
                    from { width: 0% }
                    to   { width: 100% }
                }
            `}</style>
        </div>
    )
}
