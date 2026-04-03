'use client'

import { Loader2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

interface BirthdayPerson {
    id: number
    name: string
    date: string
    masked?: boolean
}

interface SenderCandidate {
    name: string
    email?: string
}

interface BirthdaySendWishPopupProps {
    isOpen: boolean
    onClose: () => void
    currentWeek: number
    currentMonth: number
    currentYear: number
    userArea: string | null
    birthdays: BirthdayPerson[]
    senderCandidates: SenderCandidate[]
    fallbackSenderEmail?: string | null
}

function normalizeNameToEmail(name: string): string {
    const normalized = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '')

    return `${normalized || 'teacher'}@mindx.local`
}

export function BirthdaySendWishPopup({
    isOpen,
    onClose,
    currentWeek,
    currentMonth,
    currentYear,
    userArea,
    birthdays,
    senderCandidates,
    fallbackSenderEmail,
}: BirthdaySendWishPopupProps) {
    const [senderName, setSenderName] = useState('')
    const [receiverName, setReceiverName] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isMounted, setIsMounted] = useState(false)

    const visibleBirthdays = useMemo(() => birthdays.filter((b) => !b.masked), [birthdays])

    const senderOptions = useMemo(() => {
        const map = new Map<string, SenderCandidate>()

        senderCandidates.forEach((candidate) => {
            const name = candidate.name?.trim()
            if (!name) return
            map.set(name, { name, email: candidate.email || undefined })
        })

        return Array.from(map.values())
    }, [senderCandidates])

    const receiverOptions = useMemo(() => {
        return visibleBirthdays.filter((person) => person.name !== senderName)
    }, [visibleBirthdays, senderName])

    useEffect(() => {
        if (!isOpen) return

        if (!senderName && senderOptions.length > 0) {
            setSenderName(senderOptions[0].name)
        }
    }, [isOpen, senderName, senderOptions])

    useEffect(() => {
        if (!isOpen) return

        if (receiverOptions.length === 0) {
            setReceiverName('')
            return
        }

        const exists = receiverOptions.some((item) => item.name === receiverName)
        if (!receiverName || !exists) {
            setReceiverName(receiverOptions[0].name)
        }
    }, [isOpen, receiverName, receiverOptions])

    useEffect(() => {
        if (!isOpen) return
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }

        window.addEventListener('keydown', handleEscape)
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    useEffect(() => {
        setIsMounted(true)
        return () => setIsMounted(false)
    }, [])

    if (!isOpen || !isMounted) return null

    const handleSubmitWish = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setError(null)

        const trimmedMessage = message.trim()
        if (!senderName) {
            setError('Vui lòng chọn người gửi lời chúc')
            return
        }

        if (!receiverName) {
            setError('Vui lòng chọn người nhận lời chúc')
            return
        }

        if (senderName === receiverName) {
            setError('Không cần gửi lời chúc cho bản thân giáo viên')
            return
        }

        if (!trimmedMessage) {
            setError('Vui lòng nhập nội dung lời chúc')
            return
        }

        if (trimmedMessage.length > 500) {
            setError('Lời chúc tối đa 500 ký tự')
            return
        }

        const selectedSender = senderOptions.find((option) => option.name === senderName)
        const senderEmail = selectedSender?.email || fallbackSenderEmail || normalizeNameToEmail(senderName)

        setIsSubmitting(true)
        try {
            const res = await fetch('/api/birthday-wishes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: currentMonth,
                    week: currentWeek,
                    year: currentYear,
                    area: userArea,
                    birthdayNames: [receiverName],
                    senderName,
                    senderEmail,
                    message: trimmedMessage,
                }),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Không gửi được lời chúc')
            }

            setMessage('')
            onClose()
        } catch (submitError: any) {
            setError(submitError?.message || 'Không gửi được lời chúc')
        } finally {
            setIsSubmitting(false)
        }
    }

    const popupContent = (
        <div className="fixed inset-0 z-130">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-[#980f24] shadow-2xl overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/15 px-4 py-3">
                        <h3 className="text-white font-bold">Gửi lời chúc sinh nhật</h3>
                        <button
                            type="button"
                            className="rounded-lg p-1.5 text-white/85 hover:text-white hover:bg-white/10"
                            onClick={onClose}
                            aria-label="Đóng"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmitWish} className="p-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <label className="text-white text-xs font-semibold">
                                Người gửi
                                <select
                                    value={senderName}
                                    onChange={(e) => setSenderName(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white outline-none focus:border-white/40"
                                >
                                    {senderOptions.length === 0 && <option value="">Chưa có dữ liệu</option>}
                                    {senderOptions.map((option) => (
                                        <option key={option.name} value={option.name} className="text-gray-900">
                                            {option.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="text-white text-xs font-semibold">
                                Gửi tới
                                <select
                                    value={receiverName}
                                    onChange={(e) => setReceiverName(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white outline-none focus:border-white/40"
                                >
                                    {receiverOptions.length === 0 && <option value="">Không có giáo viên phù hợp</option>}
                                    {receiverOptions.map((person) => (
                                        <option key={person.id} value={person.name} className="text-gray-900">
                                            {person.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label className="block text-white text-xs font-semibold">
                            Nội dung lời chúc
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                maxLength={500}
                                rows={4}
                                placeholder="Nhập lời chúc sinh nhật"
                                className="mt-1 w-full rounded-lg border border-white/20 bg-white/10 px-2.5 py-2 text-sm text-white placeholder:text-white/60 outline-none focus:border-white/40 resize-none"
                            />
                        </label>

                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[11px] text-white/70">{message.trim().length}/500 ký tự</p>
                            <button
                                type="submit"
                                disabled={isSubmitting || !senderName || !receiverName}
                                className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <span className="inline-flex items-center gap-2">
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isSubmitting ? 'Đang gửi...' : 'Gửi lời chúc'}
                                </span>
                            </button>
                        </div>

                        {error && (
                            <p className="text-sm text-red-100 bg-red-500/35 border border-red-200/40 rounded-lg px-3 py-2">{error}</p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    )

    return createPortal(popupContent, document.body)
}
