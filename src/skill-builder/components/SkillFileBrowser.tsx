import React, { useState, useMemo } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import { SkillFile } from '../types';
import { NewFileModal } from './NewFileModal';

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children: TreeNode[];
  file?: SkillFile;
}

// Check if a tree node has any file content (recursively)
function hasFileContent(node: TreeNode): boolean {
  if (node.type === 'file') {
    return true;
  }
  return node.children.some(child => hasFileContent(child));
}

// Filter out empty directories from the tree
function filterEmptyDirs(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .filter(node => {
      if (node.type === 'file') return true;
      return hasFileContent(node);
    })
    .map(node => {
      if (node.type === 'directory') {
        return {
          ...node,
          children: filterEmptyDirs(node.children),
        };
      }
      return node;
    });
}

function buildFileTree(files: SkillFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const pathMap = new Map<string, TreeNode>();

  const sortedFiles = [...files].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  for (const file of sortedFiles) {
    const parts = file.path.split('/');
    let currentPath = '';
    let parent: TreeNode[] = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      let node = pathMap.get(currentPath);
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          type: isLast ? file.type : 'directory',
          children: [],
          file: isLast ? file : undefined,
        };
        pathMap.set(currentPath, node);
        parent.push(node);
      }

      parent = node.children;
    }
  }

  return filterEmptyDirs(root);
}

// Icons
function FolderIcon({ open }: { open?: boolean }) {
  if (open) {
    return (
      <svg className="maven-file-icon maven-file-icon-folder" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 20H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6l2 2h6c1.1 0 2 .9 2 2v10c0 1.1-.9 2-2 2zM5 6v12h14V8h-6.83l-2-2H5z"/>
      </svg>
    );
  }
  return (
    <svg className="maven-file-icon maven-file-icon-folder" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  );
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  let iconClass = 'maven-file-icon-default';

  switch (ext) {
    case 'md':
      iconClass = 'maven-file-icon-markdown';
      break;
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'sh':
      iconClass = 'maven-file-icon-code';
      break;
    case 'json':
    case 'yaml':
    case 'yml':
      iconClass = 'maven-file-icon-config';
      break;
  }

  return (
    <svg className={`maven-file-icon ${iconClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
    </svg>
  );
}

interface FileTreeNodeProps {
  node: TreeNode;
  depth: number;
  expandedDirs: Set<string>;
  toggleDir: (path: string) => void;
  selectedPath: string | null;
  onSelect: (path: string, type: 'file' | 'directory') => void;
  onDelete: (path: string) => void;
  unsavedPaths: Set<string>;
}

function FileTreeNode({
  node,
  depth,
  expandedDirs,
  toggleDir,
  selectedPath,
  onSelect,
  onDelete,
  unsavedPaths,
}: FileTreeNodeProps) {
  const isExpanded = expandedDirs.has(node.path);
  const isSelected = selectedPath === node.path;
  const isUnsaved = unsavedPaths.has(node.path);

  const handleClick = () => {
    if (node.type === 'directory') {
      toggleDir(node.path);
    } else {
      onSelect(node.path, node.type);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${node.name}?`)) {
      onDelete(node.path);
    }
  };

  return (
    <div>
      <div
        className={`maven-file-tree-node ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <span className="maven-file-tree-chevron">
            {isExpanded ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </span>
        )}
        {node.type === 'file' && <span className="maven-file-tree-spacer" />}

        {node.type === 'directory' ? (
          <FolderIcon open={isExpanded} />
        ) : (
          getFileIcon(node.name)
        )}

        <span className="maven-file-tree-name">
          {node.name}
          {isUnsaved && <span className="maven-file-tree-unsaved">*</span>}
        </span>

        <button
          className="maven-file-tree-delete"
          onClick={handleDelete}
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
        </button>
      </div>

      {node.type === 'directory' && isExpanded && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onDelete={onDelete}
              unsavedPaths={unsavedPaths}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillFileBrowser() {
  const { state, openFile, deleteFile, loadFiles } = useSkillBuilder();
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [showNewFileModal, setShowNewFileModal] = useState(false);

  const tree = useMemo(() => buildFileTree(state.files), [state.files]);

  const toggleDir = (path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelect = (path: string, type: 'file' | 'directory') => {
    if (type === 'file') {
      openFile(path);
    }
  };

  const handleDelete = async (path: string) => {
    await deleteFile(path);
  };

  return (
    <div className="maven-file-browser">
      <div className="maven-file-browser-header">
        <span className="maven-file-browser-title">Files</span>
        <div className="maven-file-browser-actions">
          <button
            className="maven-file-browser-action"
            onClick={() => loadFiles()}
            title="Refresh"
          >
            {state.isFilesLoading ? (
              <svg className="maven-spinner" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            )}
          </button>
          <button
            className="maven-file-browser-action"
            onClick={() => setShowNewFileModal(true)}
            title="New File"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="maven-file-browser-content">
        {state.isFilesLoading && state.files.length === 0 ? (
          <div className="maven-file-browser-loading">
            <svg className="maven-spinner" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
            </svg>
            Loading...
          </div>
        ) : state.files.length === 0 ? (
          <div className="maven-file-browser-empty">
            No files yet.<br />
            Click + to create one.
          </div>
        ) : (
          tree.map((node) => (
            <FileTreeNode
              key={node.path}
              node={node}
              depth={0}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
              selectedPath={state.selectedFile}
              onSelect={handleSelect}
              onDelete={handleDelete}
              unsavedPaths={state.unsavedChanges}
            />
          ))
        )}
      </div>

      <NewFileModal
        isOpen={showNewFileModal}
        onClose={() => setShowNewFileModal(false)}
      />
    </div>
  );
}
