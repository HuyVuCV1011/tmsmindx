'use client'

import ImageLightbox from '@/components/ImageLightbox'
import React, { useCallback, useMemo, useState } from 'react'

interface ImageInfo {
  src: string
  alt: string
  width: number | null
}

// ─── HTML processor ───────────────────────────────────────────────────────────

type Segment =
  | { type: 'html'; html: string }
  | { type: 'images'; images: ImageInfo[] }

function isImageOnlyElement(el: HTMLElement): boolean {
  const clone = el.cloneNode(true) as HTMLElement
  clone.querySelectorAll('.image-wrapper').forEach(w => w.remove())
  return (clone.textContent?.trim() || '').length === 0
}

function processHTML(html: string): Segment[] {
  if (typeof window === 'undefined') return [{ type: 'html', html }]

  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html')
  const root = doc.getElementById('r')!
  const segments: Segment[] = []
  let pendingImages: ImageInfo[] = []
  let pendingHtml = ''

  const flushImages = () => {
    if (pendingImages.length > 0) { segments.push({ type: 'images', images: [...pendingImages] }); pendingImages = [] }
  }
  const flushHtml = () => {
    if (pendingHtml.trim()) { segments.push({ type: 'html', html: pendingHtml }); pendingHtml = '' }
  }

  const extractImages = (el: HTMLElement): ImageInfo[] => {
    const result: ImageInfo[] = []
    el.querySelectorAll('.image-wrapper').forEach(wrapper => {
      const img = wrapper.querySelector('img')
      if (!img) return
      const src = img.getAttribute('src') || ''
      if (!src) return
      const dw = img.getAttribute('data-width') || ''
      const w = dw ? parseInt(dw, 10) : null
      result.push({ src, alt: img.getAttribute('alt') || '', width: Number.isFinite(w) ? w : null })
    })
    return result
  }

  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent?.trim() || ''
      if (t) { flushImages(); pendingHtml += child.textContent }
      continue
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue
    const el = child as HTMLElement
    const wrappers = el.querySelectorAll('.image-wrapper')

    if (wrappers.length > 0 && isImageOnlyElement(el)) {
      flushHtml()
      pendingImages.push(...extractImages(el))
    } else if (el.tagName === 'P' && wrappers.length > 0) {
      flushImages(); flushHtml()
      segments.push({ type: 'html', html: el.outerHTML })
    } else {
      flushImages()
      pendingHtml += el.outerHTML
    }
  }
  flushImages(); flushHtml()
  return segments
}

// ─── SmartImageGroup ──────────────────────────────────────────────────────────
// Layout giống Facebook: tối đa 4 ảnh hiển thị, ảnh cuối có overlay "+N"

const MAX_VISIBLE = 4

interface SmartImageGroupProps {
  images: ImageInfo[]
  globalOffset: number
  onOpenLightbox: (index: number) => void
}

function SmartImageGroup({ images, globalOffset, onOpenLightbox }: SmartImageGroupProps) {
  const total = images.length
  const visible = images.slice(0, MAX_VISIBLE)
  const hidden = total - MAX_VISIBLE // số ảnh bị ẩn

  // ── Layout grid dựa trên số ảnh hiển thị ──
  // Dùng CSS grid với template areas để đạt layout như Facebook
  const n = visible.length

  const getGridStyle = (): React.CSSProperties => {
    if (n === 1) return { display: 'grid', gridTemplateColumns: '1fr', gap: '3px' }
    if (n === 2) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px' }
    if (n === 3) return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '3px' }
    // 4 ảnh: 2x2
    return { display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '3px' }
  }

  const getItemStyle = (idx: number): React.CSSProperties => {
    // 3 ảnh: ảnh đầu span 2 rows bên trái
    if (n === 3 && idx === 0) return { gridRow: '1 / 3', gridColumn: '1 / 2' }
    return {}
  }

  const getImgHeight = (idx: number): string => {
    if (n === 1) return 'auto'
    if (n === 2) return '300px'
    if (n === 3) return idx === 0 ? '100%' : '148px'
    return '220px'
  }

  return (
    <div
      className="smart-img-group"
      style={{ ...getGridStyle(), margin: '8px 0', borderRadius: '10px', overflow: 'hidden' }}
    >
      {visible.map((img, idx) => {
        const isLast = idx === MAX_VISIBLE - 1
        const showOverlay = isLast && hidden > 0

        return (
          <div
            key={idx}
            className="smart-img-item"
            style={{
              ...getItemStyle(idx),
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
              lineHeight: 0,
              minHeight: n === 1 ? undefined : '100px',
            }}
            onClick={() => onOpenLightbox(globalOffset + idx)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.src}
              alt={img.alt}
              className="smart-img-thumb"
              draggable={false}
              style={{
                width: '100%',
                height: getImgHeight(idx),
                objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Hover overlay */}
            {!showOverlay && <div className="smart-img-hover-overlay" />}

            {/* "+N" overlay trên ảnh cuối */}
            {showOverlay && (
              <div className="smart-img-more-overlay">
                <span className="smart-img-more-count">+{hidden}</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PostContentRendererProps {
  html: string
  className?: string
}

export default function PostContentRenderer({ html, className = '' }: PostContentRendererProps) {
  const segments = useMemo(() => processHTML(html), [html])
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // Gom tất cả ảnh trong bài để lightbox navigate
  const allImages = useMemo(() => {
    const imgs: ImageInfo[] = []
    for (const seg of segments) {
      if (seg.type === 'images') imgs.push(...seg.images)
    }
    return imgs
  }, [segments])

  const openLightbox = useCallback((index: number) => setLightboxIndex(index), [])
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  // Tính global offset cho từng group
  let offset = 0

  // Handler click ảnh trong HTML segments (ảnh đơn, mix text+ảnh)
  const handleHtmlClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    const img = target.tagName === 'IMG' ? target as HTMLImageElement : target.closest('img') as HTMLImageElement | null
    if (!img) return
    const src = img.getAttribute('src') || ''
    if (!src) return
    const idx = allImages.findIndex(im => im.src === src)
    if (idx >= 0) openLightbox(idx)
  }, [allImages, openLightbox])

  return (
    <>
      <div className={`post-content-renderer ProseMirror prose prose-sm md:prose-base max-w-none text-gray-900 ${className}`}>
        {segments.map((seg, i) => {
          if (seg.type === 'images') {
            const groupOffset = offset
            offset += seg.images.length
            return (
              <SmartImageGroup
                key={i}
                images={seg.images}
                globalOffset={groupOffset}
                onOpenLightbox={openLightbox}
              />
            )
          }
          return <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} onClick={handleHtmlClick} />
        })}
      </div>

      {lightboxIndex !== null && allImages.length > 0 && (
        <ImageLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={closeLightbox}
        />
      )}
    </>
  )
}
