'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface Post {
    id: string | number
    title: string
    description: string
    banner_image: string
    post_type: string
    slug?: string // Optional slug for compatibility
}

interface SliderProps {
    posts: Post[]
}

export default function Slider({ posts }: SliderProps) {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [autoPlay, setAutoPlay] = useState(true)
    const [isTransitioning, setIsTransitioning] = useState(false)

    useEffect(() => {
        if (!autoPlay || posts.length <= 1) return

        const timer = setInterval(() => {
            handleSlideChange((currentSlide + 1) % posts.length)
        }, 6000) // Slower for better reading

        return () => clearInterval(timer)
    }, [autoPlay, posts.length, currentSlide])

    const handleSlideChange = (newIndex: number) => {
        if (isTransitioning) return
        setIsTransitioning(true)
        setCurrentSlide(newIndex)
        setTimeout(() => setIsTransitioning(false), 800) // Smoother transition
    }

    const goToPrevious = () => {
        handleSlideChange((currentSlide - 1 + posts.length) % posts.length)
        setAutoPlay(false)
    }

    const goToNext = () => {
        handleSlideChange((currentSlide + 1) % posts.length)
        setAutoPlay(false)
    }

    const goToSlide = (index: number) => {
        if (index !== currentSlide) {
            handleSlideChange(index)
            setAutoPlay(false)
        }
    }

    if (!posts.length) return null

    return (
        <div
            className="relative w-full h-[500px] md:h-[600px] rounded-3xl overflow-hidden bg-gray-950 group shadow-2xl ring-1 ring-white/10"
            onMouseEnter={() => setAutoPlay(false)}
            onMouseLeave={() => setAutoPlay(true)}
        >
            {/* Slide Container */}
            <div className="relative w-full h-full">
                {posts.map((post, index) => (
                    <div
                        key={post.id}
                        className={cn(
                            "absolute inset-0 transition-all duration-1000 ease-in-out will-change-transform transform",
                            index === currentSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-110 z-0'
                        )}
                    >
                        {/* Image with Parallax-like feel */}
                        <Image
                            src={post.banner_image || "/placeholder-banner.jpg"}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority={index === 0}
                        />

                        {/* Dramatic Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-90" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent opacity-60" />

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 text-white max-w-5xl mx-auto w-full">
                            <div className={cn(
                                "flex flex-col gap-6 transform transition-all duration-1000 delay-300",
                                index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                            )}>
                                {/* Tag */}
                                <div className="inline-flex">
                                    <span className="px-4 py-1.5 rounded-full text-xs md:text-sm font-bold tracking-wider uppercase bg-blue-600/90 hover:bg-blue-600 text-white backdrop-blur-md shadow-lg transition-colors border border-blue-500/30">
                                        {post.post_type}
                                    </span>
                                </div>

                                {/* Title */}
                                <h3 className="text-3xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-gray-400">
                                    <Link href={`/user/truyenthong/${post.slug || post.id}`} className="hover:underline decoration-blue-500/50 underline-offset-8 transition-all">
                                        {post.title}
                                    </Link>
                                </h3>

                                {/* Description */}
                                <p className="text-base md:text-lg text-gray-300 line-clamp-2 max-w-2xl leading-relaxed font-light">
                                    {post.description}
                                </p>

                                {/* Action */}
                                <div className="pt-4">
                                    <Link href={`/user/truyenthong/${post.slug || post.id}`}>
                                        <Button
                                            size="lg"
                                            className="bg-white text-gray-900 hover:bg-gray-100 font-bold rounded-full px-8 py-6 text-base shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] transition-all duration-300 hover:-translate-y-1"
                                        >
                                            Đọc ngay
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Arrows - Minimalist */}
            <div className="absolute bottom-12 right-12 z-20 flex gap-4 hidden md:flex">
                <button
                    onClick={goToPrevious}
                    className="p-4 rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black transition-all hover:scale-110 active:scale-95 group"
                    aria-label="Previous slide"
                >
                    <ChevronLeft className="w-6 h-6 group-hover:-translate-x-0.5 transition-transform" />
                </button>
                <button
                    onClick={goToNext}
                    className="p-4 rounded-full border border-white/20 bg-black/20 text-white backdrop-blur-md hover:bg-white hover:text-black transition-all hover:scale-110 active:scale-95 group"
                    aria-label="Next slide"
                >
                    <ChevronRight className="w-6 h-6 group-hover:translate-x-0.5 transition-transform" />
                </button>
            </div>

            {/* Modern Progress Indicators */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 md:left-16 md:bottom-16 md:translate-x-0 z-20 flex gap-3">
                {posts.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className="group relative py-2"
                        aria-label={`Go to slide ${index + 1}`}
                    >
                        <span className={cn(
                            "block h-1 rounded-full transition-all duration-500",
                            index === currentSlide ? "w-12 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]" : "w-2 bg-white/30 group-hover:bg-white/50"
                        )} />
                    </button>
                ))}
            </div>

            {/* Gradient Loading Bar */}
            {autoPlay && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-20">
                    <div
                        className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                        style={{
                            width: '100%',
                            transition: 'width 6000ms linear'
                        }}
                    />
                </div>
            )}
        </div>
    )
}
