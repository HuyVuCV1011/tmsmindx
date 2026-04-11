'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Crop, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ─── Kiểu dữ liệu crop được lưu vào DB ───────────────────────────────────────
export interface CropData {
  offsetX: number  // px offset từ tâm (âm = trái/trên, dương = phải/dưới)
  offsetY: number
  zoom: number     // 1.0 = fit cover, >1 = zoom in
}

/** Serialize CropData → string để lưu DB */
export function serializeCrop(data: CropData): string {
  return JSON.stringify(data)
}

/** Parse string từ DB → CropData. Fallback về center nếu lỗi. */
export function parseCrop(raw: string | null | undefined): CropData {
  if (!raw) return { offsetX: 0, offsetY: 0, zoom: 1 }
  try {
    // Legacy: nếu là "X% Y%" (format cũ) → trả về center
    if (raw.includes('%')) return { offsetX: 0, offsetY: 0, zoom: 1 }
    const parsed = JSON.parse(raw)
    if (typeof parsed.offsetX === 'number') return parsed as CropData
  } catch {}
  return { offsetX: 0, offsetY: 0, zoom: 1 }
}

/**
 * Tính CSS transform để apply CropData lên một <img> với object-fit:cover
 * Dùng cho cả preview trong form lẫn hiển thị ở PostCard / DetailView.
 */
export function cropToStyle(crop: CropData): React.CSSProperties {
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    transform: `translate(${-crop.offsetX}px, ${-crop.offsetY}px) scale(${crop.zoom})`,
    transformOrigin: 'center center',
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface ThumbnailCropperProps {
  src: string
  aspectRatio?: number
  onSave: (cropJson: string) => void
  onCancel: () => void
  initialCrop?: string  // JSON string từ DB
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ThumbnailCropper({
  src,
  aspectRatio = 16 / 9,
  onSave,
  onCancel,
  initialCrop,
}: ThumbnailCropperProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 0, h: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const initial = parseCrop(initialCrop)
  const [offset, setOffset] = useState({ x: initial.offsetX, y: initial.offsetY })
  const [zoom, setZoom] = useState(initial.zoom)

  // Load ảnh để lấy kích thước tự nhiên
  useEffect(() => {
    const img = new window.Image()
    img.onload = () => setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  // Tính giới hạn offset dựa trên zoom hiện tại
  const getMaxOffset = useCallback(() => {
    const container = containerRef.current
    if (!container || !imgNaturalSize.w) return { maxX: 0, maxY: 0 }
    const containerW = container.clientWidth
    const containerH = containerW / aspectRatio
    const scaleByW = containerW / imgNaturalSize.w
    const scaleByH = containerH / imgNaturalSize.h
    const baseScale = Math.max(scaleByW, scaleByH)
    const imgW = imgNaturalSize.w * baseScale * zoom
    const imgH = imgNaturalSize.h * baseScale * zoom
    return {
      maxX: Math.max(0, (imgW - containerW) / 2),
      maxY: Math.max(0, (imgH - containerH) / 2),
    }
  }, [aspectRatio, imgNaturalSize, zoom])

  const clampOffset = useCallback((ox: number, oy: number) => {
    const { maxX, maxY } = getMaxOffset()
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    }
  }, [getMaxOffset])

  // Clamp lại khi zoom thay đổi
  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y))
  }, [zoom, clampOffset])

  // Pointer drag
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y }
    containerRef.current?.setPointerCapture(e.pointerId)
  }, [offset])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.px
    const dy = e.clientY - dragStartRef.current.py
    setOffset(clampOffset(dragStartRef.current.ox + dx, dragStartRef.current.oy + dy))
  }, [isDragging, clampOffset])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    setZoom(prev => Math.min(3, Math.max(1, prev - e.deltaY * 0.001)))
  }, [])

  const handleSave = () => {
    onSave(serializeCrop({ offsetX: offset.x, offsetY: offset.y, zoom }))
  }

  const { maxX, maxY } = getMaxOffset()
  const canDrag = maxX > 0 || maxY > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Crop className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900">Chỉnh sửa thumbnail</h3>
          </div>
          <button type="button" onClick={onCancel} className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop area */}
        <div className="p-5 pb-3">
          <div
            ref={containerRef}
            className={`relative w-full overflow-hidden rounded-xl select-none bg-gray-900 ${
              isDragging ? 'cursor-grabbing' : canDrag ? 'cursor-grab' : 'cursor-default'
            }`}
            style={{ aspectRatio: `${aspectRatio}` }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt="Crop preview"
              draggable={false}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `translate(-50%, -50%) translate(${-offset.x}px, ${-offset.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                userSelect: 'none',
                pointerEvents: 'none',
                transition: isDragging ? 'none' : 'transform 0.08s ease-out',
              }}
            />

            {canDrag && !isDragging && (
              <div className="absolute inset-0 flex items-end justify-center pb-3 pointer-events-none">
                <span className="bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
                  Kéo để điều chỉnh vùng hiển thị
                </span>
              </div>
            )}
          </div>

          {/* Zoom slider */}
          <div className="flex items-center gap-3 mt-4 px-1">
            <button type="button" onClick={() => setZoom(z => Math.max(1, +(z - 0.1).toFixed(2)))}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-600 shrink-0">
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(parseFloat(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-blue-600"
              style={{ background: `linear-gradient(to right, #2563eb ${((zoom - 1) / 2) * 100}%, #e5e7eb ${((zoom - 1) / 2) * 100}%)` }}
            />
            <button type="button" onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))}
              className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-600 shrink-0">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">
            Cuộn chuột hoặc dùng thanh trượt để zoom · Kéo ảnh để chọn vùng
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onCancel} className="h-9 px-5 text-sm font-semibold">
            Hủy
          </Button>
          <Button type="button" onClick={handleSave} className="h-9 px-5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white">
            Lưu
          </Button>
        </div>
      </div>
    </div>
  )
}
