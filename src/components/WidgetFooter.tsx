import React, { useState } from 'react';

interface WidgetFooterProps {
  collapsed?: boolean;
  onCollapseToggle?: () => void;
  userName?: string;
}

export function WidgetFooter({
  collapsed = false,
  onCollapseToggle,
  userName,
}: WidgetFooterProps) {
  // Get display name and avatar initial
  const displayName = userName || 'User';
  const avatarInitial = displayName.charAt(0).toUpperCase();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  return (
    <div className={`maven-widget-footer ${collapsed ? 'collapsed' : ''}`}>
      {/* User Menu Popup */}
      {userMenuOpen && !collapsed && (
        <div className="maven-sidebar-user-menu">
          <div className="maven-sidebar-user-menu-branding">
            <svg className="maven-menu-branding-logo" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="50" width="120" height="110" rx="25" fill="#0a1628"/>
              <polygon points="50,50 40,20 70,45" fill="#0a1628"/>
              <polygon points="150,50 160,20 130,45" fill="#0a1628"/>
              <circle cx="72" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
              <circle cx="72" cy="95" r="12" fill="#0a1628"/>
              <circle cx="76" cy="91" r="4" fill="#faf8f5"/>
              <circle cx="128" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
              <circle cx="128" cy="95" r="12" fill="#0a1628"/>
              <circle cx="132" cy="91" r="4" fill="#faf8f5"/>
              <line x1="97" y1="95" x2="103" y2="95" stroke="#0a1628" strokeWidth="5" strokeLinecap="round"/>
              <path d="M100 118 L92 135 L100 148 L108 135 Z" fill="#e07856"/>
            </svg>
            <span>Maven v{__WIDGET_VERSION__}</span>
          </div>
        </div>
      )}

      {/* Footer Bar - Full width user panel */}
      <div className={`maven-widget-footer-bar ${collapsed ? 'collapsed' : ''}`}>
        {/* User Panel - Full Width */}
        <button
          className="maven-footer-user-panel"
          onClick={() => {
            if (collapsed && onCollapseToggle) {
              onCollapseToggle();
              setUserMenuOpen(true);
            } else {
              setUserMenuOpen(!userMenuOpen);
            }
          }}
        >
          <div className="maven-footer-user-avatar">{avatarInitial}</div>
          {!collapsed && (
            <>
              <span className="maven-footer-user-name">{displayName}</span>
              <svg
                className={`maven-footer-user-chevron ${userMenuOpen ? 'open' : ''}`}
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M4.5 6.5l3.5 3.5 3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
