'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Post {
    id: string | number
    title: string
    description: string
    banner_image: string
    post_type: string
}

interface SliderProps {
    posts: Post[]
}

export default function Slider({ posts }: SliderProps) {
    const [currentSlide, setCurrentSlide] = useState(0)
    const [autoPlay, setAutoPlay] = useState(true)

    useEffect(() => {
        if (!autoPlay) return

        const timer = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % posts.length)
        }, 5000)

        return () => clearInterval(timer)
    }, [autoPlay, posts.length])

    const goToPrevious = () => {
        setCurrentSlide(prev => (prev - 1 + posts.length) % posts.length)
        setAutoPlay(false)
    }

    const goToNext = () => {
        setCurrentSlide(prev => (prev + 1) % posts.length)
        setAutoPlay(false)
    }

    const goToSlide = (index: number) => {
        setCurrentSlide(index)
        setAutoPlay(false)
    }

    if (!posts.length) return null

    const currentPost = posts[currentSlide]

    return (
        <div className="relative w-full h-64 md:h-96 rounded-lg overflow-hidden bg-muted group">
            {/* Slide Container */}
            <div className="relative w-full h-full">
                {posts.map((post, index) => (
                    <div
                        key={post.id}
                        className={`absolute inset-0 transition-opacity duration-500 ${index === currentSlide ? 'opacity-100' : 'opacity-0'
                            }`}
                    >
                        <Image
                            src={`${post.banner_image}` || "/placeholder.svg"}
                            alt={post.title}
                            fill
                            className="object-cover"
                            priority={index === 0}
                        />
                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

                        {/* Content */}
                        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                            <div className="space-y-2">
                                <div className="inline-flex gap-2 items-center">
                                    <span className="text-xs font-semibold bg-primary px-2 py-1 rounded">
                                        {post.post_type}
                                    </span>
                                </div>
                                <h3 className="text-xl md:text-2xl font-bold line-clamp-2">
                                    {post.title}
                                </h3>
                                <p className="text-sm text-gray-200 line-clamp-1">
                                    {post.description}
                                </p>
                            </div>
                            <Link href={`/user/truyenthong/${post.id}`} className="mt-4 inline-block w-fit">
                                <Button size="sm" variant="secondary">
                                    Xem chi tiết
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Arrows */}
            <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Previous slide"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Next slide"
            >
                <ChevronRight className="w-5 h-5" />
            </button>

            {/* Dot Navigation */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                {posts.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => goToSlide(index)}
                        className={`w-2 h-2 rounded-full transition-all ${index === currentSlide
                            ? 'bg-white w-8'
                            : 'bg-white/50 hover:bg-white/75'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            {/* Autoplay Toggle */}
            <div className="absolute top-4 right-4 z-10 text-xs text-white bg-black/50 px-3 py-1 rounded">
                {autoPlay ? 'Tự động chạy' : 'Tạm dừng'}
            </div>
        </div>
    )
}
