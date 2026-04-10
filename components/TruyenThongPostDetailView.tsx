'use client'

import Comments from '@/components/Comments'
import PostCard from '@/components/post-card'
import PostContentRenderer from '@/components/PostContentRenderer'
import { PostDetailSkeleton } from '@/components/skeletons'
import { Button } from '@/components/ui/button'
import { Angry, ArrowLeft, Calendar, Check, Eye, FileText, Frown, Heart, Laugh, Share2, ThumbsUp } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import { useAuth } from '@/lib/auth-context'

export type TruyenThongPostDetailMode = 'user' | 'admin'

interface Post {
    id: string | number
    slug: string
    title: string
    description: string
    content: string
    featured_image: string
    banner_image: string
    post_type: string
    published_at: string
    view_count: number
    like_count: number
    isLiked?: boolean
    relatedPosts?: Post[]
}

interface TruyenThongPostDetailViewProps {
    mode: TruyenThongPostDetailMode
}

export function TruyenThongPostDetailView({ mode }: TruyenThongPostDetailViewProps) {
    const params = useParams()
    const pathname = usePathname()
    const { user } = useAuth()
    const [post, setPost] = useState<Post | null>(null)
    const [loading, setLoading] = useState(true)
    const [liked, setLiked] = useState(false)
    const [isLiking, setIsLiking] = useState(false)
    const [showReactions, setShowReactions] = useState(false)
    const [currentReaction, setCurrentReaction] = useState<string | null>(null)
    const reactionsRef = useRef<HTMLDivElement | null>(null)

    const isAdmin = mode === 'admin' || !!user?.isAdmin
    const backHref = mode === 'admin' ? '/admin/truyenthong' : '/user/truyenthong'
    const relatedPostBase = mode === 'admin' ? '/admin/truyenthong/posts' : '/user/truyenthong'
    const [copied, setCopied] = useState(false)

    const copyShareLink = async () => {
        try {
            const url = `${window.location.origin}${pathname}`
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast.success('Đã copy link bài viết')
            window.setTimeout(() => setCopied(false), 1200)
        } catch {
            try {
                const url = `${window.location.origin}${pathname}`
                const textarea = document.createElement('textarea')
                textarea.value = url
                textarea.style.position = 'fixed'
                textarea.style.opacity = '0'
                document.body.appendChild(textarea)
                textarea.focus()
                textarea.select()
                document.execCommand('copy')
                document.body.removeChild(textarea)
                setCopied(true)
                toast.success('Đã copy link bài viết')
                window.setTimeout(() => setCopied(false), 1200)
            } catch {
                toast.error('Không thể copy link')
            }
        }
    }

    useEffect(() => {
        const fetchPost = async () => {
            if (!params?.slug) return
            try {
                const userIdParam = user?.localId ? `?userId=${user.localId}` : ''
                const res = await fetch(`/api/truyenthong/posts/${params.slug}${userIdParam}`)
                if (!res.ok) throw new Error('Failed to fetch post')
                const data = await res.json()
                setPost(data)
                setLiked(!!data.isLiked)

                if (mode === 'user') {
                    fetch(`/api/truyenthong/posts/${params.slug}/view`, { method: 'POST' })
                }
            } catch (error) {
                console.error('Error fetching post:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPost()
    }, [params?.slug, user?.localId, mode])

    const handleLike = async () => {
        if (isLiking) return

        if (!post || !user?.localId) {
            if (!user) toast.error('Vui lòng đăng nhập để thích bài viết')
            return
        }

        setIsLiking(true)

        const previousLiked = liked
        const previousLikeCount = post.like_count

        const newLikedState = !previousLiked
        const newLikeCount = newLikedState ? previousLikeCount + 1 : previousLikeCount - 1

        setLiked(newLikedState)
        setPost(prev => prev ? { ...prev, like_count: newLikeCount } : null)

        try {
            const res = await fetch(`/api/truyenthong/posts/${post.slug}/like`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ userId: user.localId })
            })

            if (res.ok) {
                const data = await res.json()
                setLiked(data.isLiked)
                setPost(prev => prev ? { ...prev, like_count: data.like_count } : null)
            } else {
                setLiked(previousLiked)
                setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
                throw new Error('Failed to like post')
            }
        } catch (error) {
            setLiked(previousLiked)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
            console.error('Error liking post:', error)
        } finally {
            setIsLiking(false)
        }
    }

    const reactions = [
        { type: 'like', icon: ThumbsUp, label: 'Thích', color: 'text-blue-500' },
        { type: 'love', icon: Heart, label: 'Yêu thích', color: 'text-red-500' },
        { type: 'haha', icon: Laugh, label: 'Haha', color: 'text-yellow-500' },
        { type: 'sad', icon: Frown, label: 'Buồn', color: 'text-gray-500' },
        { type: 'angry', icon: Angry, label: 'Phẫn nộ', color: 'text-orange-500' },
    ]

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (reactionsRef.current && !reactionsRef.current.contains(event.target as Node)) {
                setShowReactions(false)
            }
        }

        if (showReactions) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showReactions])

    const handleReaction = async (reactionType: string, e: React.MouseEvent) => {
        e.stopPropagation()

        if (isLiking || !user?.localId) {
            if (!user) toast.error('Vui lòng đăng nhập để bày tỏ cảm xúc')
            return
        }

        setIsLiking(true)

        const previousReaction = currentReaction
        const previousLiked = liked
        const previousLikeCount = post?.like_count || 0

        if (currentReaction === reactionType) {
            setCurrentReaction(null)
            setLiked(false)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount - 1 } : null)
        } else {
            setCurrentReaction(reactionType)
            setLiked(true)
            if (!previousLiked) {
                setPost(prev => prev ? { ...prev, like_count: previousLikeCount + 1 } : null)
            }
        }

        setTimeout(() => {
            setShowReactions(false)
        }, 300)

        try {
            const res = await fetch(`/api/truyenthong/posts/${post?.slug}/like`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.localId, reaction: reactionType })
            })

            if (res.ok) {
                const data = await res.json()
                setLiked(data.isLiked)
                setPost(prev => prev ? { ...prev, like_count: data.like_count } : null)
                if (data.isLiked && data.reaction) {
                    setCurrentReaction(data.reaction)
                } else {
                    setCurrentReaction(null)
                }
            } else {
                throw new Error('Failed to react')
            }
        } catch (error) {
            setCurrentReaction(previousReaction)
            setLiked(previousLiked)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
            console.error('Error reacting:', error)
        } finally {
            setIsLiking(false)
        }
    }

    if (loading) return <PostDetailSkeleton />
    if (!post) return (
        <div className="min-h-screen flex items-center justify-center animate-in fade-in zoom-in duration-500">
            <div className="text-center">
                <div className="bg-muted p-6 rounded-full mb-6 inline-block">
                    <FileText className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-2">Không tìm thấy bài viết</h3>
                <p className="text-muted-foreground mb-6">Bài viết này không tồn tại hoặc đã bị xóa.</p>
                <Link href={backHref}>
                    <Button variant="default">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Quay lại
                    </Button>
                </Link>
            </div>
        </div>
    )

    const publishDate = new Date(post.published_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })

    const postTypeLabels: Record<string, string> = {
        'tin-tức': 'Tin tức',
        'chính-sách': 'Chính sách',
        'sự-kiện': 'Sự kiện',
        'đào-tạo': 'Đào tạo',
        'báo-cáo': 'Báo cáo',
        'thông-báo': 'Thông báo',
    }

    return (
        <div>
            <header className="border-b border-gray-200 bg-white sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto py-3 flex items-center gap-3">
                    <Link href={backHref}>
                        <Button variant="ghost" size="sm" className="gap-2 h-9 hover:bg-blue-50 hover:text-blue-600">
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </Button>
                    </Link>
                    <h1 className="text-sm font-semibold text-gray-900">
                        {mode === 'admin' ? 'Xem bài & quản lý bình luận' : 'Chi tiết bài viết'}
                    </h1>
                </div>
            </header>

            <main className="max-w-7xl mx-auto">
                <div className="relative w-full h-72 md:h-96 rounded-xl overflow-hidden mb-5 shadow-lg">
                    <Image
                        src={post.featured_image || "/placeholder.svg"}
                        alt={post.title}
                        fill
                        className="object-cover"
                        priority
                        placeholder="blur"
                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB2ZXJzaW9uPSIxLjEiLz4="
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                        <span className="inline-block px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full mb-3">
                            {postTypeLabels[post.post_type] || post.post_type}
                        </span>
                        <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">
                            {post.title}
                        </h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                    <div className="lg:col-span-3">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="font-semibold">{publishDate}</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="font-semibold">{post.view_count.toLocaleString('vi-VN')} lượt xem</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Heart className="w-3.5 h-3.5 text-blue-600" />
                                            <span className="font-semibold">{post.like_count?.toLocaleString('vi-VN') || 0} lượt thích</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={copyShareLink}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-white px-3 py-1 font-semibold text-blue-700 hover:bg-blue-50 transition"
                                            title="Copy link bài viết"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5" aria-hidden /> : <Share2 className="w-3.5 h-3.5" aria-hidden />}
                                            <span>Chia sẻ</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <article className="p-5">
                                <p className="text-base text-gray-600 italic mb-5 pb-5 border-b border-gray-200">
                                    {post.description}
                                </p>

                                <PostContentRenderer html={post.content} />

                                <div className="border-t border-gray-200 pt-5 mt-6">
                                    <div className="flex items-center gap-3 px-1">
                                        {liked && currentReaction && (
                                            <div className="flex items-center gap-1 text-xs">
                                                {(() => {
                                                    const reaction = reactions.find(r => r.type === currentReaction)
                                                    if (!reaction) return null
                                                    const Icon = reaction.icon
                                                    return (
                                                        <div className="flex items-center gap-0.5">
                                                            <Icon className={`w-3 h-3 ${reaction.color}`} />
                                                            <span className="text-muted-foreground">{post.like_count || 1}</span>
                                                        </div>
                                                    )
                                                })()}
                                            </div>
                                        )}

                                        <div
                                            ref={reactionsRef}
                                            className="relative"
                                        >
                                            <button
                                                onMouseEnter={() => setShowReactions(true)}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setShowReactions(true)
                                                }}
                                                disabled={isLiking}
                                                className={`text-xs font-semibold transition-all duration-200 cursor-pointer ${currentReaction ? 'text-blue-600' : 'text-muted-foreground hover:text-foreground'
                                                    } ${isLiking ? 'opacity-50' : ''}`}
                                            >
                                                {currentReaction ? reactions.find(r => r.type === currentReaction)?.label : 'Thích'}
                                            </button>

                                            {showReactions && (
                                                <div className="absolute bottom-full left-0 mb-2 bg-white/95 backdrop-blur-sm border border-border rounded-full shadow-2xl p-1.5 flex gap-1 z-10 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
                                                    {reactions.map((reaction, index) => {
                                                        const Icon = reaction.icon
                                                        return (
                                                            <button
                                                                key={reaction.type}
                                                                onClick={(e) => handleReaction(reaction.type, e)}
                                                                className={`p-1.5 rounded-full hover:bg-muted/80 transition-all duration-200 transform hover:scale-125 hover:-translate-y-1 cursor-pointer ${reaction.color} animate-in fade-in-0 zoom-in-50`}
                                                                style={{ animationDelay: `${index * 30}ms` }}
                                                                title={reaction.label}
                                                            >
                                                                <Icon className="w-6 h-6 drop-shadow-sm" />
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>

                    <aside>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden sticky top-20">
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-4 py-3">
                                <h3 className="text-sm font-bold text-gray-900">Thông tin bài viết</h3>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 flex-shrink-0">Loại:</span>
                                        <span className="text-gray-900">{postTypeLabels[post.post_type] || post.post_type}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 flex-shrink-0">Đăng:</span>
                                        <span className="text-gray-900">{publishDate}</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="font-semibold text-gray-600 w-16 flex-shrink-0">Lượt xem:</span>
                                        <span className="text-gray-900">{post.view_count.toLocaleString('vi-VN')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                <div className="mt-5">
                    <Comments
                        postSlug={post.slug}
                        currentUserId={user?.localId}
                        currentUserName={user?.displayName || user?.email}
                        currentUserEmail={user?.email}
                        isAdmin={isAdmin}
                    />
                </div>

                <section className="mt-5">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 px-5 py-3">
                            <h2 className="text-sm font-bold text-gray-900">Tin liên quan</h2>
                        </div>
                        <div className="p-5">
                            {post.relatedPosts && post.relatedPosts.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {post.relatedPosts.map((relatedPost: Post) => (
                                        <PostCard key={relatedPost.id} post={relatedPost} detailBasePath={relatedPostBase} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-100">
                                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Hiện tại chưa có bài viết liên quan.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </main>
        </div>
    )
}
