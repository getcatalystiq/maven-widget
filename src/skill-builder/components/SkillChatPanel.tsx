import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSkillBuilder } from '../context/SkillBuilderContext';
import { ActivityIndicator } from './ActivityIndicator';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// Simple markdown renderer for chat messages
function renderMarkdown(content: string): React.ReactNode {
  // Split by code blocks first
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith('```')) {
      // Code block
      const match = part.match(/```(\w*)\n?([\s\S]*?)```/);
      const code = match ? match[2] : part.slice(3, -3);
      return (
        <pre key={index} className="maven-chat-code-block">
          <code>{code.trim()}</code>
        </pre>
      );
    }

    // Process inline formatting
    const processed = part
      .split('\n')
      .map((line, lineIndex) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h4 key={lineIndex} className="maven-chat-heading">{line.slice(4)}</h4>;
        }
        if (line.startsWith('## ')) {
          return <h3 key={lineIndex} className="maven-chat-heading">{line.slice(3)}</h3>;
        }
        if (line.startsWith('# ')) {
          return <h2 key={lineIndex} className="maven-chat-heading">{line.slice(2)}</h2>;
        }

        // List items
        if (line.match(/^[-*] /)) {
          return <li key={lineIndex}>{processInline(line.slice(2))}</li>;
        }

        // Numbered list items
        if (line.match(/^\d+\. /)) {
          return <li key={lineIndex}>{processInline(line.replace(/^\d+\. /, ''))}</li>;
        }

        // Regular paragraph
        if (line.trim()) {
          return <p key={lineIndex}>{processInline(line)}</p>;
        }

        return null;
      })
      .filter(Boolean);

    return <React.Fragment key={index}>{processed}</React.Fragment>;
  });
}

function processInline(text: string): React.ReactNode {
  // Process bold, italic, and inline code
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(<code key={key++} className="maven-chat-inline-code">{codeMatch[1]}</code>);
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      parts.push(<strong key={key++}>{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      parts.push(<em key={key++}>{italicMatch[1]}</em>);
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Regular text - grab until next special character
    const nextSpecial = remaining.search(/[`*]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial === 0) {
      // Single special character, just add it
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    } else {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    }
  }

  return parts;
}

export function SkillChatPanel() {
  const { state, dispatch, loadFiles, apiUrl, getToken, tenantId, agentUrl, userId } = useSkillBuilder();
  const [input, setInput] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatMessages]);

  // Elapsed time counter - resets when loading starts
  useEffect(() => {
    if (state.isChatLoading) {
      setElapsedSeconds(0);
      const interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [state.isChatLoading]);

  // Listen for ESC key to cancel request
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state.isChatLoading && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };

    if (state.isChatLoading) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [state.isChatLoading]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || state.isChatLoading || !state.skillId) return;

    const userMessage = {
      id: generateId(),
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMessage });
    dispatch({ type: 'SET_CHAT_LOADING', payload: true });
    setInput('');

    // Create placeholder for assistant response
    const assistantId = generateId();
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      payload: {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      },
    });

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();
    let accumulatedContent = '';

    try {
      // Build skill files context from loaded files
      const skillFiles = state.files.map(f => ({
        path: f.path,
        content: state.fileContents[f.path] || '',
      })).filter(f => f.content); // Only include files with loaded content

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      let endpoint: string;
      let body: Record<string, unknown>;

      if (agentUrl) {
        // Direct AgentCore call (widget with JWT auth)
        endpoint = agentUrl;

        if (getToken) {
          const token = await getToken();
          headers['Authorization'] = `Bearer ${token}`;
          // AgentCore Runtime forwards custom headers to containers
          headers['X-Amzn-Bedrock-AgentCore-Runtime-Custom-Authorization'] = `Bearer ${token}`;
        }
        if (userId) {
          headers['X-Amzn-Bedrock-AgentCore-Runtime-User-Id'] = userId;
        }

        body = {
          message: userMessage.content,
          sessionId: state.chatSessionId,
          userId: userId,
          context: {
            mode: 'skill_builder',
            skillId: state.skillId,
            skillName: state.skillName,
            skillSlug: state.skillSlug,
            files: skillFiles,
          },
        };
      } else {
        // Admin API proxy (admin UI with IAM auth)
        endpoint = `${apiUrl}/tenants/${tenantId}/skill-builder`;

        if (getToken) {
          const token = await getToken();
          headers['Authorization'] = `Bearer ${token}`;
        }

        body = {
          operation: 'chat',
          skillId: state.skillId,
          message: userMessage.content,
          sessionId: state.chatSessionId,
          files: skillFiles,
        };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error('Chat request failed');

      // Handle SSE streaming
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'session') {
                dispatch({ type: 'SET_CHAT_SESSION', payload: parsed.data?.sessionId });
              } else if (parsed.type === 'progress') {
                dispatch({
                  type: 'SET_ACTIVITY',
                  payload: { tool: parsed.data?.tool, filePath: parsed.data?.filePath },
                });
              } else if (parsed.type === 'chunk') {
                accumulatedContent += parsed.data?.text || '';
                dispatch({
                  type: 'UPDATE_CHAT_MESSAGE',
                  payload: { id: assistantId, content: accumulatedContent },
                });
              } else if (parsed.type === 'files_changed') {
                await loadFiles();
              } else if (parsed.type === 'error') {
                const errorMsg = parsed.data?.message || 'Unknown error';
                const errorContent = accumulatedContent
                  ? `${accumulatedContent}\n\n Error: ${errorMsg}`
                  : ` Error: ${errorMsg}`;
                dispatch({
                  type: 'UPDATE_CHAT_MESSAGE',
                  payload: { id: assistantId, content: errorContent },
                });
              } else if (parsed.type === 'done') {
                // Chat complete
              }
            } catch {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch({
          type: 'UPDATE_CHAT_MESSAGE',
          payload: {
            id: assistantId,
            content: accumulatedContent || '*Request cancelled*',
          },
        });
      } else {
        console.error('Chat error:', error);
        dispatch({
          type: 'UPDATE_CHAT_MESSAGE',
          payload: {
            id: assistantId,
            content: 'Sorry, there was an error processing your request. Please try again.',
          },
        });
      }
    } finally {
      dispatch({ type: 'SET_CHAT_LOADING', payload: false });
      dispatch({ type: 'SET_ACTIVITY', payload: null });
      abortControllerRef.current = null;
    }
  }, [input, state.isChatLoading, state.skillId, state.chatSessionId, state.files, state.fileContents, state.skillName, state.skillSlug, apiUrl, getToken, tenantId, agentUrl, userId, dispatch, loadFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const resetChat = () => {
    dispatch({ type: 'SET_CHAT_SESSION', payload: null });
  };

  const suggestions = [
    'Help me write the SKILL.md',
    'Create a data extraction script',
    'Explain skill variables',
  ];

  return (
    <div className="maven-chat-panel">
      {/* Header */}
      <div className="maven-chat-panel-header">
        <div className="maven-chat-panel-header-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8V4H8" />
            <rect x="4" y="8" width="16" height="12" rx="2" />
            <circle cx="9" cy="14" r="1" fill="currentColor" />
            <circle cx="15" cy="14" r="1" fill="currentColor" />
          </svg>
          <span>Skill Builder</span>
        </div>
        <button
          className="maven-chat-panel-reset"
          onClick={resetChat}
          title="New conversation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="maven-chat-panel-messages">
        {state.chatMessages.length === 0 ? (
          <div className="maven-chat-panel-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8V4H8" />
              <rect x="4" y="8" width="16" height="12" rx="2" />
              <circle cx="9" cy="14" r="1" fill="currentColor" />
              <circle cx="15" cy="14" r="1" fill="currentColor" />
            </svg>
            <h3>Skill Builder Assistant</h3>
            <p>
              I can help you create and refine your skill. Ask me to write
              SKILL.md content, create scripts, or explain skill features.
            </p>
            <div className="maven-chat-panel-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="maven-chat-panel-suggestion"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          state.chatMessages
            .filter((msg) => msg.role === 'user' || msg.content)
            .map((msg) => (
              <div
                key={msg.id}
                className={`maven-chat-message ${msg.role === 'user' ? 'maven-chat-message-user' : 'maven-chat-message-assistant'}`}
              >
                <div className="maven-chat-message-avatar">
                  {msg.role === 'user' ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8V4H8" />
                      <rect x="4" y="8" width="16" height="12" rx="2" />
                      <circle cx="9" cy="14" r="1" fill="currentColor" />
                      <circle cx="15" cy="14" r="1" fill="currentColor" />
                    </svg>
                  )}
                </div>
                <div className="maven-chat-message-content">
                  {renderMarkdown(msg.content)}
                </div>
              </div>
            ))
        )}

        {/* Loading indicator */}
        {state.isChatLoading && (
          <div className="maven-chat-message maven-chat-message-assistant">
            <div className="maven-chat-message-avatar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8V4H8" />
                <rect x="4" y="8" width="16" height="12" rx="2" />
                <circle cx="9" cy="14" r="1" fill="currentColor" />
                <circle cx="15" cy="14" r="1" fill="currentColor" />
              </svg>
            </div>
            <div className="maven-chat-message-content maven-chat-message-loading">
              {state.currentActivity ? (
                <ActivityIndicator
                  tool={state.currentActivity.tool}
                  filePath={state.currentActivity.filePath}
                />
              ) : (
                <div className="maven-chat-thinking">
                  <svg className="maven-spinner" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
                  </svg>
                  <span>Thinking...</span>
                  <span className="maven-chat-elapsed">({elapsedSeconds}s)</span>
                </div>
              )}
              <div className="maven-chat-cancel-hint">
                <kbd>ESC</kbd> to cancel
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="maven-chat-panel-input">
        <form onSubmit={handleSubmit}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your skill..."
            rows={1}
            disabled={state.isChatLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || state.isChatLoading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
