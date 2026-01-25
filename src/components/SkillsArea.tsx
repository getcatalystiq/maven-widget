import React, { useState, useMemo, useEffect } from 'react';
import { Skill } from '../types';

interface SkillsAreaProps {
  skills: Skill[];
  currentUrl: string;
  selectedSkills: string[];
  onSkillToggle: (skillId: string) => void;
}

export const SkillsArea: React.FC<SkillsAreaProps> = ({
  skills,
  currentUrl,
  selectedSkills,
  onSkillToggle,
}) => {
  const [expandedSection, setExpandedSection] = useState<'relevant' | 'all' | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Collapse sections when URL changes
  useEffect(() => {
    setExpandedSection(null);
    setExpandedCategories(new Set());
  }, [currentUrl]);

  // URL pattern matching utility
  const matchesUrlPattern = (pattern: string, url: string): boolean => {
    if (!pattern) return false;

    // Extract pathname from both pattern and url (ignore domain)
    let patternPath = pattern;
    let urlPath = url;

    try {
      // If pattern looks like a full URL, extract pathname
      if (pattern.includes('://')) {
        const patternUrl = new URL(pattern);
        patternPath = patternUrl.pathname;
      } else if (!pattern.startsWith('/')) {
        // If pattern doesn't start with /, assume it's a path and add /
        patternPath = '/' + pattern;
      }

      // Extract pathname from url
      const urlObj = new URL(url);
      urlPath = urlObj.pathname;
    } catch {
      // If URL parsing fails, use the strings as-is
    }

    // Convert pattern to regex
    let regexPattern = patternPath
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\\\{(\w+)\\\}/g, '(?<$1>[^/]+)') // {param} -> named capture
      .replace(/\*/g, '.*'); // * -> .*

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

  // Group skills by category
  const skillsByCategory = useMemo(() => {
    const grouped = new Map<string, Skill[]>();
    skills.forEach(skill => {
      const category = skill.category || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(skill);
    });
    return grouped;
  }, [skills]);

  const toggleSection = (section: 'relevant' | 'all') => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const hasRelevantSkills = relevantSkills.length > 0;

  return (
    <div className="maven-skills-area">
      {/* Section Headers Row */}
      {hasRelevantSkills ? (
        <div className="maven-section-headers">
          <button
            className={`maven-section-header ${expandedSection === 'relevant' ? 'active' : ''}`}
            onClick={() => toggleSection('relevant')}
          >
            <span className="maven-section-label">Relevant Skills</span>
            <span className="maven-section-count">{relevantSkills.length}</span>
            <span className="maven-section-toggle">{expandedSection === 'relevant' ? '−' : '+'}</span>
          </button>
          <button
            className={`maven-section-header ${expandedSection === 'all' ? 'active' : ''}`}
            onClick={() => toggleSection('all')}
          >
            <span className="maven-section-label">All Skills</span>
            <span className="maven-section-count">{skills.length}</span>
            <span className="maven-section-toggle">{expandedSection === 'all' ? '−' : '+'}</span>
          </button>
        </div>
      ) : (
        <div className="maven-section-headers">
          <button
            className={`maven-section-header ${expandedSection === 'all' ? 'active' : ''}`}
            onClick={() => toggleSection('all')}
          >
            <span className="maven-section-label">All Skills</span>
            <span className="maven-section-count">{skills.length}</span>
            <span className="maven-section-toggle">{expandedSection === 'all' ? '−' : '+'}</span>
          </button>
        </div>
      )}

      {/* Expanded Content Area */}
      {expandedSection === 'relevant' && (
        <div className="maven-section-content">
          {relevantSkills.length === 0 ? (
            <div className="maven-empty-state">
              <p>No skills match this page</p>
            </div>
          ) : (
            <div className="maven-skills-scroll">
              {relevantSkills.map(skill => (
                <button
                  key={skill.id}
                  className={`maven-skill-card ${selectedSkills.includes(skill.id) ? 'selected' : ''}`}
                  onClick={() => onSkillToggle(skill.id)}
                  title={skill.description}
                >
                  <span className="maven-skill-emoji">{skill.emoji || '⚡'}</span>
                  <span className="maven-skill-name">{skill.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {expandedSection === 'all' && (
        <div className="maven-section-content">
          {Array.from(skillsByCategory.entries()).map(([category, categorySkills]) => {
            const isExpanded = expandedCategories.has(category);
            const categoryEmoji = categorySkills[0]?.emoji || '📁';

            return (
              <div key={category} className="maven-category">
                <button
                  className="maven-category-header"
                  onClick={() => toggleCategory(category)}
                >
                  <span className="maven-category-icon">{categoryEmoji}</span>
                  <span className="maven-category-name">{category}</span>
                  <span className="maven-category-toggle">{isExpanded ? '−' : '+'}</span>
                </button>
                {isExpanded && (
                  <div className="maven-category-skills">
                    {categorySkills.map(skill => (
                      <button
                        key={skill.id}
                        className={`maven-skill-item ${selectedSkills.includes(skill.id) ? 'selected' : ''}`}
                        onClick={() => onSkillToggle(skill.id)}
                        title={skill.description}
                      >
                        <span className="maven-skill-emoji">{skill.emoji || '⚡'}</span>
                        <span className="maven-skill-name">{skill.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
