import React, { useState, useCallback, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginScreenProps {
  title?: string;
  subtitle?: string;
  avatar?: string;
}

export function LoginScreen({ title = 'Maven AI', subtitle, avatar }: LoginScreenProps) {
  const { login, register, isLoading, error, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    // Validate email
    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address');
      return;
    }

    // Validate password
    if (!password || password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return;
    }

    // Validate confirm password for registration
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setValidationError('Passwords do not match');
        return;
      }
    }

    // Attempt login or register
    if (mode === 'login') {
      await login(email, password);
    } else {
      await register(email, password);
    }
  }, [mode, email, password, confirmPassword, login, register, clearError]);

  const toggleMode = useCallback(() => {
    setMode(mode === 'login' ? 'register' : 'login');
    setValidationError(null);
    clearError();
    setConfirmPassword('');
  }, [mode, clearError]);

  const displayError = validationError || error;

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Logo / Avatar */}
        <div style={styles.logoContainer}>
          {avatar ? (
            <img src={avatar} alt={title} style={styles.avatar} />
          ) : (
            <div style={styles.defaultLogo}>
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <rect x="40" y="50" width="120" height="110" rx="25" fill="currentColor"/>
                <polygon points="50,50 40,20 70,45" fill="currentColor"/>
                <polygon points="150,50 160,20 130,45" fill="currentColor"/>
                <circle cx="72" cy="95" r="25" fill="var(--maven-bg)" stroke="currentColor" strokeWidth="4"/>
                <circle cx="72" cy="95" r="12" fill="currentColor"/>
                <circle cx="76" cy="91" r="4" fill="var(--maven-bg)"/>
                <circle cx="128" cy="95" r="25" fill="var(--maven-bg)" stroke="currentColor" strokeWidth="4"/>
                <circle cx="128" cy="95" r="12" fill="currentColor"/>
                <circle cx="132" cy="91" r="4" fill="var(--maven-bg)"/>
                <line x1="97" y1="95" x2="103" y2="95" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
                <path d="M100 118 L92 135 L100 148 L108 135 Z" fill="#e07856"/>
              </svg>
            </div>
          )}
        </div>

        {/* Title */}
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Error Message */}
          {displayError && (
            <div style={styles.errorBox}>
              <svg viewBox="0 0 20 20" fill="currentColor" style={styles.errorIcon}>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {displayError}
            </div>
          )}

          {/* Email Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isLoading}
              style={styles.input}
              autoComplete="email"
              autoFocus
            />
          </div>

          {/* Password Input */}
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={isLoading}
              style={styles.input}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                disabled={isLoading}
                style={styles.input}
                autoComplete="new-password"
              />
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              ...styles.submitButton,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? (
              <span style={styles.loadingContainer}>
                <svg style={styles.spinner} viewBox="0 0 24 24" fill="none">
                  <circle style={styles.spinnerCircle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                </svg>
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <p style={styles.toggleText}>
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={toggleMode}
            disabled={isLoading}
            style={styles.toggleButton}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '24px',
    backgroundColor: 'var(--maven-bg)',
    fontFamily: 'var(--maven-font-body)',
  },
  content: {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoContainer: {
    width: '64px',
    height: '64px',
    marginBottom: '16px',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: '16px',
    objectFit: 'cover',
  },
  defaultLogo: {
    width: '100%',
    height: '100%',
    color: 'var(--maven-primary)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--maven-text)',
    margin: '0 0 4px 0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--maven-text-secondary)',
    margin: '0 0 24px 0',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px',
    backgroundColor: 'var(--maven-error-light)',
    color: 'var(--maven-error)',
    borderRadius: 'var(--maven-radius-md)',
    fontSize: '13px',
    lineHeight: 1.4,
  },
  errorIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--maven-text)',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    color: 'var(--maven-text)',
    backgroundColor: 'var(--maven-bg-surface)',
    border: '1px solid var(--maven-border-dark)',
    borderRadius: 'var(--maven-radius-md)',
    outline: 'none',
    transition: 'border-color 150ms ease, box-shadow 150ms ease',
    fontFamily: 'inherit',
  },
  submitButton: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--maven-text-inverse)',
    backgroundColor: 'var(--maven-primary)',
    border: 'none',
    borderRadius: 'var(--maven-radius-md)',
    transition: 'background-color 150ms ease, opacity 150ms ease',
    fontFamily: 'inherit',
  },
  loadingContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  spinner: {
    width: '16px',
    height: '16px',
    animation: 'spin 1s linear infinite',
  },
  spinnerCircle: {
    opacity: 0.25,
    strokeDasharray: 'calc(3.14159 * 20)',
    strokeDashoffset: 'calc(3.14159 * 20 * 0.75)',
  },
  toggleText: {
    marginTop: '24px',
    fontSize: '13px',
    color: 'var(--maven-text-secondary)',
    textAlign: 'center',
  },
  toggleButton: {
    padding: 0,
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--maven-accent)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'underline',
    fontFamily: 'inherit',
  },
};
