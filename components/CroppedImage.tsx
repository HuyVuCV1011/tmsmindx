'use client'

import React from 'react'
import { parseCrop } from './ThumbnailCropper'

interface CroppedImageProps {
  src: string
  alt: string
  cropData?: string | null   // JSON string từ DB (thumbnail_position)
  className?: string
  style?: React.CSSProperties
}

/**
 * Hiển thị ảnh với crop/zoom đúng như lúc admin chỉnh sửa.
 * Dùng transform giống hệt ThumbnailCropper modal.
 */
export default function CroppedImage({ src, alt, cropData, className = '', style }: CroppedImageProps) {
  const crop = parseCrop(cropData)

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || '/placeholder.svg'}
        alt={alt}
        draggable={false}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(-50%, -50%) translate(${-crop.offsetX}px, ${-crop.offsetY}px) scale(${crop.zoom})`,
          transformOrigin: 'center center',
        }}
      />
    </div>
  )
}
