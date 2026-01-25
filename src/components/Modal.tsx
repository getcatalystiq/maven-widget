import React from 'react';

interface ModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Modal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="maven-modal-overlay" onClick={onCancel}>
      <div className="maven-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maven-modal-header">
          <h3>{title}</h3>
        </div>
        <div className="maven-modal-body">
          <p>{message}</p>
        </div>
        <div className="maven-modal-footer">
          <button
            className="maven-modal-button maven-modal-button-cancel"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="maven-modal-button maven-modal-button-confirm"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
