import React, { useState, useEffect } from 'react';
import { useMCPs, MCPServer } from '../../contexts/MCPsContext';
import { MCPsList } from './MCPsList';
import { MCPModal } from './MCPModal';
import { GoogleWorkspaceSetup } from './GoogleWorkspaceSetup';

interface MCPsViewProps {
  onClose: () => void;
}

// Icons
const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-admin-header-icon">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export function MCPsView({ onClose }: MCPsViewProps) {
  const { state, loadServers, oauthProviders, loadOAuthProviders } = useMCPs();
  const [showModal, setShowModal] = useState(false);
  const [showGoogleSetup, setShowGoogleSetup] = useState(false);
  const [editingServer, setEditingServer] = useState<MCPServer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Check if Google OAuth is already configured
  const hasGoogleProvider = oauthProviders.some(
    (p) => p.vendor.toLowerCase() === 'google'
  );

  useEffect(() => {
    loadServers();
    loadOAuthProviders();
  }, [loadServers, loadOAuthProviders]);

  const handleAddServer = () => {
    setEditingServer(null);
    setShowModal(true);
  };

  const handleEditServer = (server: MCPServer) => {
    setEditingServer(server);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingServer(null);
  };

  const filteredServers = state.servers.filter((server) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      server.name.toLowerCase().includes(query) ||
      server.endpoint.toLowerCase().includes(query) ||
      (server.description?.toLowerCase().includes(query) ?? false)
    );
  });

  return (
    <div className="maven-admin-view">
      {/* Header */}
      <div className="maven-admin-header">
        <div className="maven-admin-header-left">
          <ServerIcon />
          <div>
            <h2 className="maven-admin-title">MCP Servers</h2>
            <p className="maven-admin-subtitle">
              {state.servers.length} server{state.servers.length !== 1 ? 's' : ''} configured
            </p>
          </div>
        </div>
        <div className="maven-admin-header-right">
          <button className="maven-admin-btn maven-admin-btn-primary" onClick={handleAddServer}>
            <PlusIcon />
            Add MCP Server
          </button>
          <button className="maven-admin-close" onClick={onClose} title="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="maven-admin-content">
        {/* Search */}
        <div className="maven-admin-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search MCP servers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Quick Integrations */}
        {!hasGoogleProvider && !searchQuery && (
          <div className="maven-quick-integrations">
            <h4>Quick Setup</h4>
            <div className="maven-quick-integrations-grid">
              <button
                type="button"
                className="maven-quick-integration-card"
                onClick={() => setShowGoogleSetup(true)}
              >
                <div className="maven-quick-integration-icon">
                  <GoogleIcon />
                </div>
                <div className="maven-quick-integration-content">
                  <span className="maven-quick-integration-name">Google Workspace</span>
                  <span className="maven-quick-integration-desc">Gmail, Calendar, Drive</span>
                </div>
                <span className="maven-quick-integration-action">Configure</span>
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state.error && (
          <div className="maven-admin-error">
            <AlertIcon />
            <span>{state.error}</span>
          </div>
        )}

        {/* Content */}
        {state.isLoading ? (
          <div className="maven-admin-loading">
            <div className="maven-admin-spinner" />
            <span>Loading MCP servers...</span>
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="maven-admin-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <h3>{searchQuery ? 'No matching servers' : 'No MCP servers configured'}</h3>
            <p>
              {searchQuery
                ? 'Try a different search term'
                : 'Add an MCP server to enable tool integrations'}
            </p>
            {!searchQuery && (
              <button className="maven-admin-btn maven-admin-btn-primary" onClick={handleAddServer}>
                <PlusIcon />
                Add MCP Server
              </button>
            )}
          </div>
        ) : (
          <MCPsList
            servers={filteredServers}
            onEdit={handleEditServer}
          />
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <MCPModal
          server={editingServer}
          onClose={handleCloseModal}
        />
      )}

      {/* Google Workspace Setup */}
      {showGoogleSetup && (
        <GoogleWorkspaceSetup
          onSuccess={() => {
            setShowGoogleSetup(false);
            loadOAuthProviders();
            loadServers();
          }}
          onCancel={() => setShowGoogleSetup(false)}
        />
      )}
    </div>
  );
}
