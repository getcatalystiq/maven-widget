import { useState } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TEMPLATES = [
  { label: 'SKILL.md', path: 'SKILL.md', type: 'file' as const },
  { label: 'Python Script', path: 'scripts/script.py', type: 'file' as const },
  { label: 'Shell Script', path: 'scripts/run.sh', type: 'file' as const },
  { label: 'Reference Doc', path: 'references/docs.md', type: 'file' as const },
];

export function NewFileModal({ isOpen, onClose }: NewFileModalProps) {
  const { createFile } = useSkillBuilder();
  const [path, setPath] = useState('');
  const [fileType, setFileType] = useState<'file' | 'directory'>('file');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!path.trim()) {
      setError('Please enter a path');
      return;
    }

    setIsCreating(true);
    setError(null);
    try {
      await createFile(path.trim(), fileType);
      onClose();
      setPath('');
      setFileType('file');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTemplateClick = (template: typeof TEMPLATES[0]) => {
    setPath(template.path);
    setFileType(template.type);
  };

  if (!isOpen) return null;

  return (
    <div className="maven-skill-modal-overlay" onClick={onClose}>
      <div className="maven-skill-modal maven-new-file-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Create New File</h3>

        <div className="maven-new-file-type">
          <label className={`maven-new-file-type-option ${fileType === 'file' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="fileType"
              value="file"
              checked={fileType === 'file'}
              onChange={() => setFileType('file')}
            />
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            File
          </label>
          <label className={`maven-new-file-type-option ${fileType === 'directory' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="fileType"
              value="directory"
              checked={fileType === 'directory'}
              onChange={() => setFileType('directory')}
            />
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
            </svg>
            Folder
          </label>
        </div>

        <input
          type="text"
          placeholder={fileType === 'file' ? 'path/to/file.md' : 'path/to/folder'}
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />

        {fileType === 'file' && (
          <div className="maven-new-file-templates">
            <span className="maven-new-file-templates-label">Quick templates:</span>
            <div className="maven-new-file-templates-list">
              {TEMPLATES.map((template) => (
                <button
                  key={template.path}
                  className="maven-new-file-template"
                  onClick={() => handleTemplateClick(template)}
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="maven-new-file-error">{error}</div>
        )}

        <div className="maven-skill-modal-actions">
          <button
            className="maven-skill-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="maven-skill-modal-create"
            onClick={handleCreate}
            disabled={!path.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
