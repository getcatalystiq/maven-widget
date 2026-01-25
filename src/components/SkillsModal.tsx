import React, { useMemo } from 'react';
import type { Skill } from '../types';

interface SkillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skills: Skill[];
  currentUrl: string;
  onSkillClick: (skillId: string) => void;
}

export function SkillsModal({ isOpen, onClose, skills, currentUrl, onSkillClick }: SkillsModalProps) {
  // URL pattern matching utility (same as SkillsBar)
  const matchesUrlPattern = (pattern: string, url: string): boolean => {
    if (!pattern) return false;

    let patternPath = pattern;
    let urlPath = url;

    try {
      if (pattern.includes('://')) {
        const patternUrl = new URL(pattern);
        patternPath = patternUrl.pathname;
      } else if (!pattern.startsWith('/')) {
        patternPath = '/' + pattern;
      }

      const urlObj = new URL(url);
      urlPath = urlObj.pathname;
    } catch {
      // If URL parsing fails, use the strings as-is
    }

    let regexPattern = patternPath
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\{(\w+)\\}/g, '(?<$1>[^/]+)')
      .replace(/\*/g, '.*');

    regexPattern = '^' + regexPattern + '$';

    try {
      const regex = new RegExp(regexPattern);
      return regex.test(urlPath);
    } catch {
      return false;
    }
  };

  // Filter relevant skills based on URL patterns
  const relevantSkills = useMemo(() => {
    return skills.filter(skill => {
      if (!skill.url_patterns || skill.url_patterns.length === 0) return false;
      return skill.url_patterns.some(pattern => matchesUrlPattern(pattern, currentUrl));
    });
  }, [skills, currentUrl]);

  // Other skills (not relevant to current URL)
  const otherSkills = useMemo(() => {
    const relevantIds = new Set(relevantSkills.map(s => s.id));
    return skills.filter(s => !relevantIds.has(s.id));
  }, [skills, relevantSkills]);

  if (!isOpen) return null;

  return (
    <div className="maven-skills-modal-overlay" onClick={onClose}>
      <div className="maven-skills-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maven-skills-modal-header">
          <h3>Skills</h3>
          <button className="maven-skills-modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="maven-skills-modal-content">
          {/* Relevant skills section */}
          {relevantSkills.length > 0 && (
            <div className="maven-skills-modal-section">
              <div className="maven-skills-modal-section-title">Relevant to this page</div>
              <div className="maven-skills-modal-grid">
                {relevantSkills.map(skill => (
                  <button
                    key={skill.id}
                    className="maven-skills-modal-item relevant"
                    onClick={() => onSkillClick(skill.id)}
                  >
                    <span className="maven-skills-modal-emoji">{skill.emoji || '⚡'}</span>
                    <div className="maven-skills-modal-info">
                      <span className="maven-skills-modal-name">{skill.name}</span>
                      {skill.description && (
                        <span className="maven-skills-modal-desc">{skill.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All other skills section */}
          {otherSkills.length > 0 && (
            <div className="maven-skills-modal-section">
              {relevantSkills.length > 0 && (
                <div className="maven-skills-modal-section-title">All skills</div>
              )}
              <div className="maven-skills-modal-grid">
                {otherSkills.map(skill => (
                  <button
                    key={skill.id}
                    className="maven-skills-modal-item"
                    onClick={() => onSkillClick(skill.id)}
                  >
                    <span className="maven-skills-modal-emoji">{skill.emoji || '⚡'}</span>
                    <div className="maven-skills-modal-info">
                      <span className="maven-skills-modal-name">{skill.name}</span>
                      {skill.description && (
                        <span className="maven-skills-modal-desc">{skill.description}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
