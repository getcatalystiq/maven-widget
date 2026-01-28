import React from 'react';
import type { Connector } from '../../types/connector';

interface ConnectorCardProps {
  connector: Connector;
  onConnect: () => void;
  onDisconnect: () => void;
  isConnecting?: boolean;
  isDisconnecting?: boolean;
}

// Check if string is an emoji (simple heuristic)
function isEmoji(str: string): boolean {
  if (!str) return false;
  // Match common emoji ranges
  return /^[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(str);
}

// Default plug icon SVG path
const PLUG_ICON = (
  <>
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </>
);

// Visual component indicator (eye icon)
function VisualBadge() {
  return (
    <span title="Has visual interface">
      <svg className="maven-connector-visual-badge" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </span>
  );
}

export function ConnectorCard({
  connector,
  onConnect,
  onDisconnect,
  isConnecting,
  isDisconnecting,
}: ConnectorCardProps) {
  return (
    <div className="maven-connector-card">
      <div className="maven-connector-header">
        <div className="maven-connector-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {PLUG_ICON}
          </svg>
        </div>
        <div className="maven-connector-info">
          <div className="maven-connector-name-row">
            <h4 className="maven-connector-name">{connector.name}</h4>
          </div>
          {connector.description && (
            <p className="maven-connector-description">{connector.description}</p>
          )}
        </div>
      </div>

      <div className="maven-connector-status">
        <div className="maven-connector-status-row">
          {connector.connected ? (
            <>
              <span className="maven-connector-status-badge maven-connector-status-connected">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Connected
              </span>
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="maven-connector-button maven-connector-button-disconnect"
              >
                {isDisconnecting ? (
                  <>
                    <span className="maven-connector-spinner" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </button>
            </>
          ) : connector.requiresOauth ? (
            <>
              <span className="maven-connector-status-badge maven-connector-status-disconnected">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                </svg>
                Not connected
              </span>
              <button
                onClick={onConnect}
                disabled={isConnecting}
                className="maven-connector-button maven-connector-button-connect"
              >
                {isConnecting ? (
                  <>
                    <span className="maven-connector-spinner" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </button>
            </>
          ) : (
            <span className="maven-connector-status-badge maven-connector-status-available">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Available
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
