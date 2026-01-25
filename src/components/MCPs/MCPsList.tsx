import React, { useState } from 'react';
import { useMCPs, MCPServer } from '../../contexts/MCPsContext';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

interface MCPsListProps {
  servers: MCPServer[];
  onEdit: (server: MCPServer) => void;
}

// Icons
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const SyncIcon = ({ spinning = false }: { spinning?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    style={spinning ? { animation: 'spin 1s linear infinite' } : undefined}
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
  </svg>
);

const ServerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="8" rx="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12" style={{ flexShrink: 0 }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const XCircleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export function MCPsList({ servers, onEdit }: MCPsListProps) {
  const { deleteServer, syncServer } = useMCPs();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null);

  const handleDeleteClick = (server: MCPServer) => {
    setServerToDelete(server);
  };

  const handleConfirmDelete = async () => {
    if (!serverToDelete) return;

    setDeletingId(serverToDelete.id);
    await deleteServer(serverToDelete.id);
    setDeletingId(null);
    setServerToDelete(null);
  };

  const handleCancelDelete = () => {
    setServerToDelete(null);
  };

  const handleSync = async (server: MCPServer) => {
    setSyncingId(server.id);
    await syncServer(server.id, server.name);
    setSyncingId(null);
  };

  const getTypeBadge = (type: string) => {
    const color = type === 'gateway-target' ? '#6366f1' : '#8b5cf6';
    return (
      <span
        className="maven-admin-table-badge"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {type === 'gateway-target' ? 'Gateway Target' : 'MCP Wrapper'}
      </span>
    );
  };

  return (
    <div className="maven-admin-table-wrapper">
      <table className="maven-admin-table">
        <thead>
          <tr>
            <th>MCP Server</th>
            <th>Type</th>
            <th>Status</th>
            <th style={{ textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr
              key={server.id}
              style={{ opacity: server.enabled ? 1 : 0.6 }}
            >
              <td>
                <div className="maven-admin-table-item">
                  <div className="maven-admin-table-icon">
                    <ServerIcon />
                  </div>
                  <div>
                    <div className="maven-admin-table-name">
                      {server.name}
                      {!!server.credentialProvider && (
                        <span
                          className="maven-admin-table-badge maven-admin-table-badge-info"
                          title="Authenticated"
                          style={{ marginLeft: 6 }}
                        >
                          <LockIcon />
                        </span>
                      )}
                    </div>
                    <div className="maven-admin-table-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <LinkIcon />
                      <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {server.endpoint}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td>{getTypeBadge(server.type)}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {server.enabled ? (
                    <span className="maven-admin-table-badge" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircleIcon />
                      Ready
                    </span>
                  ) : (
                    <span className="maven-admin-table-badge" style={{ backgroundColor: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <XCircleIcon />
                      Disabled
                    </span>
                  )}
                  {server.type === 'mcp-wrapper' && (
                    server.schemaSynced ? (
                      <span style={{ fontSize: 12, color: '#22c55e' }}>
                        {server.toolsCount || 0} tools
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>Not synced</span>
                    )
                  )}
                </div>
              </td>
              <td>
                <div className="maven-admin-table-actions">
                  {server.type === 'mcp-wrapper' && (
                    <button
                      className="maven-admin-table-action"
                      onClick={() => handleSync(server)}
                      disabled={syncingId === server.id}
                      title="Sync Tools"
                    >
                      <SyncIcon spinning={syncingId === server.id} />
                    </button>
                  )}
                  <button
                    className="maven-admin-table-action"
                    onClick={() => onEdit(server)}
                    title="Edit"
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="maven-admin-table-action maven-admin-table-action-delete"
                    onClick={() => handleDeleteClick(server)}
                    disabled={deletingId === server.id}
                    title="Delete"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmDeleteModal
        isOpen={!!serverToDelete}
        itemType="MCP server"
        itemName={serverToDelete?.name || ''}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={deletingId === serverToDelete?.id}
      />
    </div>
  );
}
