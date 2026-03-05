"use client";
import { AlertTriangle, X } from "lucide-react";

interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    variant?: 'danger' | 'warning';
}

export default function ConfirmDialog({ open, title, message, confirmText = "Xác nhận", cancelText = "Hủy", onConfirm, onCancel, variant = 'danger' }: Props) {
    if (!open) return null;
    const isDanger = variant === 'danger';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in zoom-in-95">
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-full ${isDanger ? 'bg-red-100' : 'bg-amber-100'}`}>
                            <AlertTriangle className={`h-6 w-6 ${isDanger ? 'text-red-600' : 'text-amber-600'}`} />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
                            <p className="mt-2 text-sm text-gray-600">{message}</p>
                        </div>
                        <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100"><X className="h-5 w-5 text-gray-400" /></button>
                    </div>
                </div>
                <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{cancelText}</button>
                    <button onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium text-white rounded-lg shadow ${isDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
