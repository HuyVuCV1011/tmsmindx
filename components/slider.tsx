'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Post {
    id: string | number
    title: string
    description: string
    banner_image: string
    post_type: string
    slug?: string
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
        }, 5000)

        return () => clearInterval(timer)
    }, [autoPlay, posts.length, currentSlide])

    const handleSlideChange = (newIndex: number) => {
        if (isTransitioning) return
        setIsTransitioning(true)
        setCurrentSlide(newIndex)
        setTimeout(() => setIsTransitioning(false), 600)
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

    const currentPost = posts[currentSlide]

    return (
        <div
            className="relative w-full h-64 md:h-[28rem] rounded-2xl overflow-hidden bg-gray-900 group shadow-2xl border border-gray-200"
            onMouseEnter={() => setAutoPlay(false)}
            onMouseLeave={() => setAutoPlay(true)}
        >
            {/* Slide Container */}
            <div className="relative w-full h-full">
                {posts.map((post, index) => (
                    <div
                        key={post.id}
                        className={`absolute inset-0 transition-all duration-700 ease-in-out ${index === currentSlide
                                ? 'opacity-100 scale-100'
                                : 'opacity-0 scale-105'
                            }`}
                    >
                        <Image
                            src={`${post.banner_image}` || "/placeholder.svg"}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority={index === 0}
                            loading={index === 0 ? "eager" : "lazy"}
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10 text-white">
                            <div className={`space-y-4 transform transition-all duration-700 delay-100 ${index === currentSlide
                                    ? 'translate-y-0 opacity-100'
                                    : 'translate-y-4 opacity-0'
                                }`}>
                                <div className="inline-flex gap-2 items-center">
                                    <span className="text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 rounded-full shadow-lg backdrop-blur-sm">
                                        {post.post_type}
                                    </span>
                                </div>
                                <h3 className="text-2xl md:text-4xl font-bold line-clamp-2 drop-shadow-2xl leading-tight">
                                    {post.title}
                                </h3>
                                <p className="text-sm md:text-base text-gray-200 line-clamp-2 max-w-3xl leading-relaxed">
                                    {post.description}
                                </p>
                                <Link href={`/user/truyenthong/${post.slug || post.id}`} className="inline-block w-fit">
                                    <Button size="sm" className="mt-2 bg-white text-blue-600 hover:bg-blue-50 hover:scale-105 font-bold shadow-xl transition-all">
                                        Xem chi tiết →
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            <button
                onClick={goToPrevious}
                disabled={isTransitioning}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white backdrop-blur-sm text-blue-600 p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 hover:scale-110 disabled:opacity-50 shadow-xl"
                aria-label="Previous slide"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <button
                onClick={goToNext}
                disabled={isTransitioning}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white backdrop-blur-sm text-blue-600 p-3 rounded-full transition-all opacity-0 group-hover:opacity-100 hover:scale-110 disabled:opacity-50 shadow-xl"
                aria-label="Next slide"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dot Navigation */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {posts.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        disabled={isTransitioning}
                        className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide
                                ? 'bg-white w-8 shadow-lg'
                                : 'bg-white/50 hover:bg-white/75 w-2'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            {/* Progress Bar */}
            {autoPlay && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-black/20 z-10">
                    <div
                        className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-[5000ms] linear shadow-lg"
                        style={{ width: autoPlay ? '100%' : '0%' }}
                    />
                </div>
            )}
        </div>
    )
}
