"use client";

import { AlertTriangle, Lock, Trash2, X } from "lucide-react";
import { useState } from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  requireTextConfirm?: boolean;
  confirmKeyword?: string;
  icon?: "delete" | "lock" | "warning";
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  type = "warning",
  requireTextConfirm = false,
  confirmKeyword = "XOA",
  icon = "warning"
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (requireTextConfirm && inputValue !== confirmKeyword) {
      return;
    }
    onConfirm();
    setInputValue("");
  };

  const handleClose = () => {
    setInputValue("");
    onClose();
  };

  const isConfirmDisabled = requireTextConfirm && inputValue !== confirmKeyword;

  const icons = {
    delete: <Trash2 className="h-6 w-6" />,
    lock: <Lock className="h-6 w-6" />,
    warning: <AlertTriangle className="h-6 w-6" />,
  };

  const iconColors = {
    danger: "text-red-600",
    warning: "text-orange-600",
    info: "text-blue-600",
  };

  const buttonColors = {
    danger: "bg-red-600 hover:bg-red-700",
    warning: "bg-orange-600 hover:bg-orange-700",
    info: "bg-blue-600 hover:bg-blue-700",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className={`${iconColors[type]}`}>{icons[icon]}</div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="text-sm text-gray-600 whitespace-pre-line">{message}</div>

          {requireTextConfirm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nhập <span className="font-bold text-red-600">&quot;{confirmKeyword}&quot;</span> để xác nhận:
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                placeholder={confirmKeyword}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${buttonColors[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
