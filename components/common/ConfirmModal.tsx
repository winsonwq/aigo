"use client";

// 通用确认对话框组件
// 使用 DaisyUI 的 modal 实现

import { useEffect, useRef } from "react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonType?: "primary" | "secondary" | "accent" | "error" | "warning" | "info" | "success";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  confirmButtonType = "error",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <button className="btn btn-outline" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className={
              confirmButtonType === "error"
                ? "btn btn-error"
                : confirmButtonType === "warning"
                  ? "btn btn-warning"
                  : confirmButtonType === "success"
                    ? "btn btn-success"
                    : confirmButtonType === "info"
                      ? "btn btn-info"
                      : confirmButtonType === "accent"
                        ? "btn btn-accent"
                        : "btn btn-primary"
            }
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onClick={onCancel}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
