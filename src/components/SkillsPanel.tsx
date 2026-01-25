import React, { useState } from 'react';
import type { Skill } from '../types';

interface SkillsPanelProps {
  skills: Skill[];
  selectedSkills: string[];
  onToggleSkill: (skillId: string) => void;
}

export function SkillsPanel({ skills, selectedSkills, onToggleSkill }: SkillsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (skills.length === 0) {
    return null;
  }

  return (
    <div className="maven-skills-panel">
      <div className="maven-skills-header">
        <h4>Skills</h4>
        <button
          className="maven-skills-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse skills' : 'Expand skills'}
        >
          {isExpanded ? 'Hide' : 'Show'}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              width: '14px',
              height: '14px',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="maven-skills-list">
          {skills.map((skill) => {
            const isSelected = selectedSkills.includes(skill.id);

            return (
              <button
                key={skill.id}
                className={`maven-skill-chip ${isSelected ? 'active' : ''}`}
                onClick={() => onToggleSkill(skill.id)}
                title={skill.description}
              >
                {skill.icon && (
                  <span className="maven-skill-icon">{skill.icon}</span>
                )}
                <span>{skill.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
