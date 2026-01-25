import React, { useMemo } from 'react';
import type { Skill } from '../types';

interface SkillsBarProps {
  skills: Skill[];
  currentUrl: string;
  onSkillClick: (skillId: string) => void;
  onShowMore: () => void;
}

const MAX_VISIBLE_SKILLS = 5;

export function SkillsBar({ skills, currentUrl, onSkillClick, onShowMore }: SkillsBarProps) {

  // URL pattern matching utility (same as SkillsArea)
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
      .replace(/\\\{(\w+)\\\}/g, '(?<$1>[^/]+)')
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

  // Show relevant skills first, then fill up to MAX_VISIBLE_SKILLS with other skills
  const displayedSkills = useMemo(() => {
    const combined = [...relevantSkills, ...otherSkills];
    return combined.slice(0, MAX_VISIBLE_SKILLS);
  }, [relevantSkills, otherSkills]);

  const remainingCount = skills.length - displayedSkills.length;

  if (skills.length === 0) return null;

  return (
    <div className="maven-skills-bar">
      <div className="maven-skills-bar-content">
        {/* Show up to MAX_VISIBLE_SKILLS */}
        {displayedSkills.map(skill => (
          <button
            key={skill.id}
            className={`maven-skills-bar-item ${relevantSkills.includes(skill) ? 'relevant' : ''}`}
            onClick={() => onSkillClick(skill.id)}
            title={skill.description || skill.name}
          >
            <span className="maven-skills-bar-emoji">{skill.emoji || '⚡'}</span>
            <span className="maven-skills-bar-name">{skill.name}</span>
          </button>
        ))}

        {/* Show More button - opens modal */}
        {remainingCount > 0 && (
          <button
            className="maven-skills-bar-toggle"
            onClick={onShowMore}
          >
            <span className="maven-skills-bar-toggle-text">+ {remainingCount} More</span>
          </button>
        )}
      </div>
    </div>
  );
}
