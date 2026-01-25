import React from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  itemType: string; // e.g., "prompt", "skill", "database"
  itemName: string; // The name/identifier of the item being deleted
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  itemType,
  itemName,
  onConfirm,
  onCancel,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="maven-modal-overlay" onClick={onCancel}>
      <div className="maven-modal maven-modal-delete" onClick={(e) => e.stopPropagation()}>
        <div className="maven-modal-header maven-modal-header-delete">
          <div className="maven-modal-delete-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
            </svg>
          </div>
          <h3>Delete {itemType}?</h3>
        </div>
        <div className="maven-modal-body">
          <p>
            Are you sure you want to delete <strong>"{itemName}"</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="maven-modal-footer">
          <button
            className="maven-modal-button maven-modal-button-cancel"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className="maven-modal-button maven-modal-button-delete"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
