import React from 'react';
import { useConnectors } from '../../contexts/ConnectorsContext';
import { ConnectorCard } from './ConnectorCard';

interface ConnectorsViewProps {
  onClose: () => void;
}

export function ConnectorsView({ onClose }: ConnectorsViewProps) {
  const {
    connectors,
    loading,
    error,
    connectingId,
    disconnectingId,
    connect,
    disconnect,
    refresh,
  } = useConnectors();

  return (
    <div className="maven-connectors-view">
      {error && (
        <div className="maven-connectors-error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
          <button onClick={refresh} className="maven-connectors-retry">
            Retry
          </button>
        </div>
      )}

      <div className="maven-connectors-list">
        {loading && connectors.length === 0 ? (
          // Loading skeletons
          <div className="maven-connectors-loading">
            <div className="maven-connector-skeleton" />
            <div className="maven-connector-skeleton" />
            <div className="maven-connector-skeleton" />
          </div>
        ) : connectors.length === 0 ? (
          // Empty state
          <div className="maven-connectors-empty">
            <div className="maven-connectors-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 22v-5" />
                <path d="M9 8V2" />
                <path d="M15 8V2" />
                <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
              </svg>
            </div>
            <p className="maven-connectors-empty-title">No connectors available</p>
            <p className="maven-connectors-empty-text">
              Your administrator hasn't configured any connectors yet.
            </p>
          </div>
        ) : (
          // Connector list
          connectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              onConnect={() => connect(connector.id)}
              onDisconnect={() => disconnect(connector.id)}
              isConnecting={connectingId === connector.id}
              isDisconnecting={disconnectingId === connector.id}
            />
          ))
        )}
      </div>
    </div>
  );
}
