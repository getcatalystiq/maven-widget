import { useEffect, useState } from 'react';

// Tool name to friendly label mapping
const TOOL_INFO: Record<string, { label: string; verb: string; icon: string }> = {
  Write: { label: 'Writing', verb: 'Writing to', icon: 'file' },
  Edit: { label: 'Editing', verb: 'Editing', icon: 'pencil' },
  MultiEdit: { label: 'Editing', verb: 'Editing', icon: 'pencil' },
  Read: { label: 'Reading', verb: 'Reading', icon: 'file' },
  Bash: { label: 'Running command', verb: 'Running', icon: 'terminal' },
  Glob: { label: 'Searching files', verb: 'Searching', icon: 'folder-search' },
  Grep: { label: 'Searching content', verb: 'Searching in', icon: 'search' },
  execute_python: { label: 'Running Python', verb: 'Running', icon: 'code' },
  WebFetch: { label: 'Fetching URL', verb: 'Fetching', icon: 'search' },
  WebSearch: { label: 'Searching web', verb: 'Searching', icon: 'search' },
};

// Icon components
function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FolderSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 19H4a2 2 0 01-2-2V6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v4" />
      <circle cx="17" cy="17" r="3" />
      <path d="M21 21l-1.5-1.5" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function LoaderIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="maven-activity-spinner">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function getIcon(iconType: string) {
  switch (iconType) {
    case 'file':
      return <FileIcon />;
    case 'pencil':
      return <PencilIcon />;
    case 'terminal':
      return <TerminalIcon />;
    case 'search':
      return <SearchIcon />;
    case 'folder-search':
      return <FolderSearchIcon />;
    case 'code':
      return <CodeIcon />;
    default:
      return <LoaderIcon />;
  }
}

interface ActivityIndicatorProps {
  tool: string;
  filePath?: string;
}

export function ActivityIndicator({ tool, filePath }: ActivityIndicatorProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Reset and start elapsed time counter when tool/filePath changes
  useEffect(() => {
    setElapsedSeconds(0);
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [tool, filePath]);

  // Get tool info or fallback
  const toolInfo = TOOL_INFO[tool] || {
    label: 'Working',
    verb: 'Using',
    icon: 'loader',
  };

  // Build display text
  let displayText = toolInfo.label;
  if (filePath) {
    // Extract filename from path for cleaner display
    const filename = filePath.split('/').pop() || filePath;
    displayText = `${toolInfo.verb} ${filename}`;
  }

  // Format elapsed time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="maven-activity-indicator">
      <div className="maven-activity-icon">
        {getIcon(toolInfo.icon)}
        <div className="maven-activity-icon-spinner">
          <LoaderIcon />
        </div>
      </div>
      <span className="maven-activity-text">{displayText}...</span>
      <span className="maven-activity-time">({formatTime(elapsedSeconds)})</span>
    </div>
  );
}
