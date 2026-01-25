import React, { useState, useEffect, useCallback } from 'react';
import type { App } from '../types';

// Built-in apps (hardcoded placeholders)
interface BuiltInApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  url?: string;  // External app URL - if set, opens in AppViewer
  connectorSlug?: string;  // If set, fetches OAuth token from this connector
}

const BUILT_IN_APPS: BuiltInApp[] = [
  {
    id: 'steward',
    name: 'Steward',
    icon: 'briefcase',
    description: 'General Manager for your entire business.',
    url: 'https://d2qlaeaampu5rt.cloudfront.net/embedded',
  },
  {
    id: 'envoy',
    name: 'Envoy',
    icon: 'mail',
    description: 'Manage all your comms. Leads, outbound, organic content, etc.',
    url: 'https://d38beagy3imun6.cloudfront.net/app',  // Envoy embedded webapp
    connectorSlug: 'envoy',  // Uses Envoy connector OAuth token
  },
  {
    id: 'broker',
    name: 'Broker',
    icon: 'target',
    description: 'Manage all your paid advertising.',
  },
  {
    id: 'ambassador',
    name: 'Ambassador',
    icon: 'link',
    description: 'Partnerships and distribution.',
  },
  {
    id: 'concierge',
    name: 'Concierge',
    icon: 'headphones',
    description: 'Manage your customer support.',
  },
  {
    id: 'closer',
    name: 'Closer',
    icon: 'dollar-sign',
    description: 'Manage all your sales.',
  },
  {
    id: 'sage',
    name: 'Sage',
    icon: 'chart-line',
    description: 'Analytics for your business.',
  },
  {
    id: 'treasurer',
    name: 'Treasurer',
    icon: 'credit-card',
    description: 'Manage all your payments and finances.',
  },
];

interface AppsManagerProps {
  tenantId: string;
  tenantSlug: string;
  userId?: string;
  userRole?: string;
  apiUrl: string;
  getToken?: () => Promise<string>;
  onAppSelect: (app: App) => void;
  activeAppId?: string;
}

// Simple icon mapping for common Lucide icons
const ICON_PATHS: Record<string, string> = {
  'box': 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
  'mail': 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 3l-8 5-8-5',
  'chart-bar': 'M12 20V10M18 20V4M6 20v-4',
  'chart-line': 'M3 3v18h18M21 9l-9 9-4-4-3 3',
  'database': 'M21 5c0 1.1-3.6 2-8 2S5 6.1 5 5m16 0v14c0 1.1-3.6 2-8 2s-8-.9-8-2V5m16 0c0-1.1-3.6-2-8-2S5 3.9 5 5m0 7c0 1.1 3.6 2 8 2s8-.9 8-2',
  'file-text': 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  'folder': 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  'layout-dashboard': 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  'list': 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  'settings': 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
  'sparkles': 'M12 3l1.12 3.78a2 2 0 0 0 1.1 1.1L18 9l-3.78 1.12a2 2 0 0 0-1.1 1.1L12 15l-1.12-3.78a2 2 0 0 0-1.1-1.1L6 9l3.78-1.12a2 2 0 0 0 1.1-1.1zM5 19l.34-1.13a1 1 0 0 1 .66-.66L7 17l-1-.34a1 1 0 0 1-.66-.66L5 15l-.34 1a1 1 0 0 1-.66.66L3 17l1 .34a1 1 0 0 1 .66.66zM18 12l.69-2.31a1 1 0 0 1 .66-.66L22 8l-2.65-.89a1 1 0 0 1-.66-.66L18 4l-.69 2.31a1 1 0 0 1-.66.66L14 8l2.65.89a1 1 0 0 1 .66.66z',
  'table': 'M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18',
  'user': 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'users': 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  'zap': 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  'target': 'M22 12A10 10 0 1 1 2 12 10 10 0 0 1 22 12zM18 12A6 6 0 1 1 6 12 6 6 0 0 1 18 12zM14 12A2 2 0 1 1 10 12 2 2 0 0 1 14 12z',
  'headphones': 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
  'dollar-sign': 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  'credit-card': 'M1 4h22v16H1zM1 10h22',
  'briefcase': 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2',
  'link': 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
};

function AppIcon({ name, className }: { name: string; className?: string }) {
  const path = ICON_PATHS[name] || ICON_PATHS['box'];
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

export function AppsManager({
  tenantId,
  tenantSlug,
  userId,
  userRole,
  apiUrl,
  getToken,
  onAppSelect,
  activeAppId,
}: AppsManagerProps) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = userRole === 'admin' || userRole === 'developer';

  const loadApps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken ? await getToken() : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Build query params - use widget endpoint for public CORS access
      const params = new URLSearchParams({
        status: 'published',
      });
      if (userId) params.set('user_id', userId);
      if (isAdmin) params.set('is_admin', 'true');

      const response = await fetch(
        `${apiUrl}/widget/${tenantSlug}/apps?${params.toString()}`,
        { headers, credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to load apps');
      }

      const data = await response.json();
      setApps(data.apps || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenantSlug, userId, isAdmin, apiUrl, getToken]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  if (loading) {
    return (
      <div className="maven-apps-manager">
        <div className="maven-apps-loading">
          <div className="maven-apps-spinner" />
          <span>Loading apps...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="maven-apps-manager">
        <div className="maven-apps-error">
          <span>{error}</span>
          <button onClick={loadApps} className="maven-apps-retry">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="maven-apps-manager">
      {/* Built-in Section */}
      <div className="maven-apps-section">
        <h3 className="maven-apps-section-header">Built-in</h3>
        <div className="maven-apps-grid">
          {BUILT_IN_APPS.map((builtInApp) => (
            <button
              key={builtInApp.id}
              className="maven-app-card"
              onClick={() => {
                if (builtInApp.url) {
                  // Built-in app with external URL - open in AppViewer
                  onAppSelect({
                    id: builtInApp.id,
                    tenant_id: tenantId,
                    name: builtInApp.name,
                    slug: builtInApp.id,
                    description: builtInApp.description,
                    icon: builtInApp.icon,
                    visibility: 'shared',
                    status: 'published',
                    published_version: 1,
                    config: {},
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    url: builtInApp.url,  // External URL triggers iframe mode
                    connectorSlug: builtInApp.connectorSlug,  // For OAuth token lookup
                  });
                } else {
                  // Placeholder - built-in apps without URL
                  console.log('Built-in app clicked:', builtInApp.id);
                }
              }}
            >
              <div className="maven-app-card-icon">
                <AppIcon name={builtInApp.icon} />
              </div>
              <div className="maven-app-card-content">
                <span className="maven-app-card-name">{builtInApp.name}</span>
                <span className="maven-app-card-description">{builtInApp.description}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Section */}
      <div className="maven-apps-section">
        <h3 className="maven-apps-section-header">Custom</h3>
        {apps.length === 0 ? (
          <div className="maven-apps-empty">
            <AppIcon name="sparkles" className="maven-apps-empty-icon" />
            <p className="maven-apps-empty-title">No apps yet</p>
            <p className="maven-apps-empty-subtitle">
              Ask the assistant to create an app for you
            </p>
          </div>
        ) : (
          <div className="maven-apps-grid">
            {apps.map((app) => (
              <button
                key={app.id}
                className={`maven-app-card ${activeAppId === app.id ? 'active' : ''}`}
                onClick={() => onAppSelect(app)}
              >
                <div className="maven-app-card-icon">
                  <AppIcon name={app.icon || 'box'} />
                </div>
                <div className="maven-app-card-content">
                  <span className="maven-app-card-name">{app.name}</span>
                  {app.description && (
                    <span className="maven-app-card-description">{app.description}</span>
                  )}
                </div>
                {app.visibility === 'personal' && (
                  <span className="maven-app-card-badge">Personal</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
