'use client'

import React from "react"

import { useState } from 'react'
import { GripVertical, Plus, Edit2, Trash2, Eye, EyeOff, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'

interface Slider {
    id: string
    title: string
    order: number
    status: 'active' | 'inactive'
    duration: number
    autoPlay: boolean
    slideCount: number
}

const mockSliders: Slider[] = [
    {
        id: '1',
        title: 'Slider chính trang chủ',
        order: 1,
        status: 'active',
        duration: 5000,
        autoPlay: true,
        slideCount: 5,
    },
    {
        id: '2',
        title: 'Slider khuyến mãi mùa hè',
        order: 2,
        status: 'active',
        duration: 7000,
        autoPlay: true,
        slideCount: 3,
    },
    {
        id: '3',
        title: 'Slider sự kiện công ty',
        order: 3,
        status: 'inactive',
        duration: 5000,
        autoPlay: false,
        slideCount: 4,
    },
]

export default function SlidersManagementPage() {
    const [sliders, setSliders] = useState<Slider[]>(mockSliders)
    const [autoPlayEnabled, setAutoPlayEnabled] = useState(true)
    const [globalDuration, setGlobalDuration] = useState(5000)
    const [draggedId, setDraggedId] = useState<string | null>(null)

    const handleDelete = (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa slider này?')) {
            setSliders(sliders.filter(s => s.id !== id))
        }
    }

    const handleToggleStatus = (id: string) => {
        setSliders(
            sliders.map(s =>
                s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s
            )
        )
    }

    const handleDragStart = (id: string) => {
        setDraggedId(id)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (targetId: string) => {
        if (draggedId && draggedId !== targetId) {
            const draggedIndex = sliders.findIndex(s => s.id === draggedId)
            const targetIndex = sliders.findIndex(s => s.id === targetId)

            const newSliders = [...sliders]
                ;[newSliders[draggedIndex], newSliders[targetIndex]] = [
                    newSliders[targetIndex],
                    newSliders[draggedIndex],
                ]

            newSliders.forEach((slider, idx) => {
                slider.order = idx + 1
            })

            setSliders(newSliders)
            setDraggedId(null)
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-col md:flex-row gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Quản lý Slider</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Tổng cộng: {sliders.length} slider
                    </p>
                </div>
                <Button className="gap-2 bg-primary hover:bg-primary/90 transition-all hover:scale-105 shadow-md cursor-pointer">
                    <Plus className="w-4 h-4" />
                    Tạo slider mới
                </Button>
            </div>

            {/* Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Cài đặt chung</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={autoPlayEnabled}
                                    onChange={e => setAutoPlayEnabled(e.target.checked)}
                                    className="rounded cursor-pointer"
                                />
                                Bật tự động chạy cho tất cả slider
                            </Label>
                        </div>
                        <div>
                            <Label htmlFor="duration">Thời gian chuyển slide (ms)</Label>
                            <Input
                                id="duration"
                                type="number"
                                value={globalDuration}
                                onChange={e => setGlobalDuration(Number(e.target.value))}
                                min="1000"
                                step="500"
                            />
                        </div>
                    </div>

                    <div className="bg-muted p-3 rounded text-sm text-muted-foreground">
                        💡 Các cài đặt này sẽ áp dụng cho tất cả slider khi được tạo hoặc cập nhật.
                    </div>
                </CardContent>
            </Card>

            {/* Sliders List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Danh sách Slider</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {sliders.map(slider => (
                            <div
                                key={slider.id}
                                draggable
                                onDragStart={() => handleDragStart(slider.id)}
                                onDragOver={handleDragOver}
                                className={`flex items-center gap-4 p-5 border border-border rounded-xl hover:bg-muted/80 hover:border-primary/30 shadow-sm transition-all cursor-move group ${draggedId === slider.id ? 'opacity-50 bg-muted scale-95' : ''
                                    }`}
                            >
                                <GripVertical className="w-5 h-5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />

                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-foreground group-hover:text-primary transition-colors">{slider.title}</p>
                                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                        <span className="bg-muted px-2 py-0.5 rounded-full">Thứ tự: #{slider.order}</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {slider.duration / 1000}s
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {slider.slideCount} slides
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <Badge
                                        variant={slider.status === 'active' ? 'default' : 'secondary'}
                                        className={slider.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}
                                    >
                                        {slider.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                                    </Badge>

                                    <div className="flex bg-background rounded-lg border shadow-sm p-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleToggleStatus(slider.id)}
                                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                                            title={slider.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                                        >
                                            {slider.status === 'active' ? (
                                                <Eye className="w-4 h-4" />
                                            ) : (
                                                <EyeOff className="w-4 h-4" />
                                            )}
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 transition-colors cursor-pointer"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(slider.id)}
                                            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
                💡 Kéo và thả để sắp xếp thứ tự hiển thị slider. Slider ở trên cùng sẽ được hiển thị
                trước.
            </div>
        </div>
    )
}
