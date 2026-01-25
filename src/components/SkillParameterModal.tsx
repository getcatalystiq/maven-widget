import React, { useState, useEffect } from 'react';
import { Skill, SkillVariable } from '../types';

interface SkillParameterModalProps {
  isOpen: boolean;
  skill: Skill | null;
  onSubmit: (parameters: Record<string, any>) => void;
  onCancel: () => void;
}

export function SkillParameterModal({
  isOpen,
  skill,
  onSubmit,
  onCancel,
}: SkillParameterModalProps) {
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset parameters when modal opens or skill changes
  useEffect(() => {
    if (isOpen && skill) {
      // Initialize parameters with empty values
      const initialParams: Record<string, any> = {};
      skill.variables?.forEach((variable) => {
        initialParams[variable.name] = '';
      });
      setParameters(initialParams);
      setErrors({});
    }
  }, [isOpen, skill]);

  if (!isOpen || !skill || !skill.variables || skill.variables.length === 0) {
    return null;
  }

  const handleInputChange = (variableName: string, value: any) => {
    setParameters((prev) => ({
      ...prev,
      [variableName]: value,
    }));
    // Clear error for this field
    if (errors[variableName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[variableName];
        return newErrors;
      });
    }
  };

  const validateAndSubmit = () => {
    const newErrors: Record<string, string> = {};

    // Validate required fields
    skill.variables?.forEach((variable) => {
      if (variable.required && !parameters[variable.name]) {
        newErrors[variable.name] = `${variable.label} is required`;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Filter out empty parameters
    const filledParameters = Object.entries(parameters).reduce(
      (acc, [key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, any>
    );

    onSubmit(filledParameters);
  };

  const renderInput = (variable: SkillVariable) => {
    const value = parameters[variable.name] || '';
    const error = errors[variable.name];

    switch (variable.type) {
      case 'text':
        return (
          <div key={variable.name} className="maven-skill-param-field">
            <label className="maven-skill-param-label">
              {variable.label}
              {variable.required && <span className="maven-required">*</span>}
            </label>
            <input
              type="text"
              className={`maven-skill-param-input ${error ? 'maven-input-error' : ''}`}
              value={value}
              placeholder={variable.placeholder}
              onChange={(e) => handleInputChange(variable.name, e.target.value)}
            />
            {error && <span className="maven-error-message">{error}</span>}
          </div>
        );

      case 'number':
        return (
          <div key={variable.name} className="maven-skill-param-field">
            <label className="maven-skill-param-label">
              {variable.label}
              {variable.required && <span className="maven-required">*</span>}
            </label>
            <input
              type="number"
              className={`maven-skill-param-input ${error ? 'maven-input-error' : ''}`}
              value={value}
              placeholder={variable.placeholder}
              onChange={(e) => handleInputChange(variable.name, e.target.value)}
            />
            {error && <span className="maven-error-message">{error}</span>}
          </div>
        );

      case 'date':
        return (
          <div key={variable.name} className="maven-skill-param-field">
            <label className="maven-skill-param-label">
              {variable.label}
              {variable.required && <span className="maven-required">*</span>}
            </label>
            <input
              type="date"
              className={`maven-skill-param-input ${error ? 'maven-input-error' : ''}`}
              value={value}
              onChange={(e) => handleInputChange(variable.name, e.target.value)}
            />
            {error && <span className="maven-error-message">{error}</span>}
          </div>
        );

      case 'select':
        return (
          <div key={variable.name} className="maven-skill-param-field">
            <label className="maven-skill-param-label">
              {variable.label}
              {variable.required && <span className="maven-required">*</span>}
            </label>
            <select
              className={`maven-skill-param-input ${error ? 'maven-input-error' : ''}`}
              value={value}
              onChange={(e) => handleInputChange(variable.name, e.target.value)}
            >
              <option value="">
                {variable.placeholder || 'Select an option'}
              </option>
              {variable.options?.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            {error && <span className="maven-error-message">{error}</span>}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="maven-modal-overlay" onClick={onCancel}>
      <div className="maven-modal maven-skill-param-modal" onClick={(e) => e.stopPropagation()}>
        <div className="maven-modal-header">
          <h3>
            {skill.emoji && <span className="maven-skill-emoji">{skill.emoji}</span>}
            {skill.name}
          </h3>
        </div>
        <div className="maven-modal-body">
          {skill.description && (
            <p className="maven-skill-description">{skill.description}</p>
          )}
          <div className="maven-skill-params-form">
            {skill.variables?.map((variable) => renderInput(variable))}
          </div>
        </div>
        <div className="maven-modal-footer">
          <button
            className="maven-modal-button maven-modal-button-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="maven-modal-button maven-modal-button-confirm"
            onClick={validateAndSubmit}
          >
            Run Skill
          </button>
        </div>
      </div>
    </div>
  );
}
