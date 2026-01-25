import React from 'react';

interface ModeSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

export function ModeSwitch({ checked, onChange, className = '' }: ModeSwitchProps) {
  return (
    <div className={`maven-mode-switch ${className}`}>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`maven-mode-switch-track ${checked ? 'checked' : ''}`}
      >
        {/* Sparkle icon (left) */}
        <span className={`maven-mode-switch-icon left ${checked ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
            <path d="M5 19l1 3 1-3 3-1-3-1-1-3-1 3-3 1 3 1z" />
            <path d="M18 15l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16 17l1.5-.5.5-1.5z" />
          </svg>
        </span>

        {/* Task icon (right) */}
        <span className={`maven-mode-switch-icon right ${!checked ? 'active' : ''}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
        </span>

        {/* Sliding knob */}
        <span className="maven-mode-switch-knob" />
      </button>
    </div>
  );
}
