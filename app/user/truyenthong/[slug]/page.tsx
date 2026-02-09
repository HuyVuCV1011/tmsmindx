'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Eye, Calendar, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import PostCard from '@/components/post-card'
import Comments from '@/components/Comments'
import { useParams } from 'next/navigation'

import { useAuth } from '@/lib/auth-context'

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



export default function PostDetailPage() {
    const params = useParams()
    const { user } = useAuth()
    const [post, setPost] = useState<Post | null>(null)
    const [loading, setLoading] = useState(true)
    const [liked, setLiked] = useState(false)
    const [isLiking, setIsLiking] = useState(false) // Prevent multiple clicks

    useEffect(() => {
        const fetchPost = async () => {
            if (!params?.slug) return
            try {
                // Fetch post details with user ID to check if liked
                const userIdParam = user?.localId ? `?userId=${user.localId}` : ''
                const res = await fetch(`/api/truyenthong/posts/${params.slug}${userIdParam}`)
                if (!res.ok) throw new Error('Failed to fetch post')
                const data = await res.json()
                setPost(data)
                setLiked(!!data.isLiked)

                // Increment view count on load (only once per session normally, simplified here)
                fetch(`/api/truyenthong/posts/${params.slug}/view`, { method: 'POST' })
            } catch (error) {
                console.error('Error fetching post:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchPost()
    }, [params?.slug, user?.localId])

    const handleLike = async () => {
        // Prevent multiple clicks - nếu đang xử lý thì return
        if (isLiking) return
        
        if (!post || !user?.localId) {
            if (!user) alert('Vui lòng đăng nhập để thích bài viết')
            return
        }

        // Set flag đang xử lý
        setIsLiking(true)

        // Optimistic update: Cập nhật UI ngay lập tức
        const previousLiked = liked
        const previousLikeCount = post.like_count

        // Toggle liked state và update like count ngay
        const newLikedState = !previousLiked
        const newLikeCount = newLikedState ? previousLikeCount + 1 : previousLikeCount - 1
        
        setLiked(newLikedState)
        setPost(prev => prev ? { ...prev, like_count: newLikeCount } : null)

        // Gửi request đến server ở background
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
                // Sync lại với server response (trong trường hợp có sai lệch)
                setLiked(data.isLiked)
                setPost(prev => prev ? { ...prev, like_count: data.like_count } : null)
            } else {
                // Nếu API fail, revert lại state cũ
                setLiked(previousLiked)
                setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
                throw new Error('Failed to like post')
            }
        } catch (error) {
            // Revert lại state cũ nếu có lỗi
            setLiked(previousLiked)
            setPost(prev => prev ? { ...prev, like_count: previousLikeCount } : null)
            console.error('Error liking post:', error)
        } finally {
            // Release flag sau khi xử lý xong
            setIsLiking(false)
        }
    }

    if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
    if (!post) return <div className="min-h-screen flex items-center justify-center">Post not found</div>

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
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card sticky top-0 z-40 shadow-sm">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                    <Link href="/user/truyenthong">
                        <Button variant="ghost" size="sm" className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            Quay lại
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold text-foreground">Chi tiết bài viết</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 py-8">
                {/* Banner */}
                <div className="relative w-full h-80 rounded-lg overflow-hidden mb-8 bg-muted">
                    <Image
                        src={post.banner_image || "/placeholder.svg"}
                        alt={post.title}
                        fill
                        className="object-cover"
                        priority
                    />
                </div>

                {/* Title and Meta */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Badge variant="default">
                            {postTypeLabels[post.post_type] || post.post_type}
                        </Badge>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                        {post.title}
                    </h1>

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-b border-border pb-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{publishDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4" />
                            <span>{post.view_count.toLocaleString('vi-VN')} lượt xem</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Heart className="w-4 h-4" />
                            <span>{post.like_count?.toLocaleString('vi-VN') || 0} lượt thích</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Content */}
                        <article className="prose prose-sm md:prose-base max-w-none text-foreground mb-8">
                            <p className="text-lg text-muted-foreground italic mb-6">
                                {post.description}
                            </p>

                            <div className="space-y-4" dangerouslySetInnerHTML={{ __html: post.content }}></div>
                        </article>

                        {/* Like Button */}
                        <div className="border-t border-border pt-6 mb-8">
                            <Button
                                variant="outline"
                                onClick={handleLike}
                                disabled={isLiking}
                                className={`gap-2 transition-all duration-300 transform active:scale-95 group shadow-sm
                                    ${liked
                                        ? 'bg-rose-50 border-rose-200 text-rose-500 opacity-70 hover:opacity-90'
                                        : 'hover:bg-rose-500 hover:text-white hover:border-rose-500 active:bg-rose-600'
                                    }
                                    ${isLiking ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Heart className={`w-4 h-4 transition-colors ${liked ? 'fill-rose-500 text-rose-500' : 'group-hover:fill-current'} ${isLiking ? 'animate-pulse' : ''}`} />
                                <span className="font-medium cursor-pointer">
                                    {isLiking ? 'Đang xử lý...' : liked ? 'Đã thích bài viết' : 'Thích bài viết'}
                                </span>
                            </Button>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <aside>
                        {/* Post Info Card */}
                        <Card className="mb-6 sticky top-20">
                            <CardContent className="p-4 space-y-4">
                                <div>
                                    <h3 className="font-semibold text-foreground mb-2">Thông tin bài viết</h3>
                                    <div className="space-y-2 text-sm text-muted-foreground">
                                        <p>
                                            <strong>Loại:</strong> {postTypeLabels[post.post_type] || post.post_type}
                                        </p>
                                        <p>
                                            <strong>Đăng:</strong> {publishDate}
                                        </p>
                                        <p>
                                            <strong>Lượt xem:</strong> {post.view_count.toLocaleString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </aside>
                </div>

                {/* Comments Section */}
                <Comments 
                    postSlug={post.slug}
                    currentUserId={user?.localId}
                    currentUserName={user?.displayName || user?.email}
                    currentUserEmail={user?.email}
                    isAdmin={user?.isAdmin}
                />

                {/* Related Posts */}
                <section className="mt-16 border-t border-border pt-8">
                    <h2 className="text-2xl font-bold text-foreground mb-6">Tin liên quan</h2>

                    {post.relatedPosts && post.relatedPosts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {post.relatedPosts.map((relatedPost: Post) => (
                                <PostCard key={relatedPost.id} post={relatedPost} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-muted/30 rounded-lg">
                            <p className="text-muted-foreground">Hiện tại chưa có bài viết liên quan.</p>
                        </div>
                    )}
                </section>
            </main>
        </div>
    )
}
