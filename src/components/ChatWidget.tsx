import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { SkillsBar } from './SkillsBar';
import { SkillsModal } from './SkillsModal';
import { SessionSidebar } from './SessionSidebar';
import { WidgetFooter } from './WidgetFooter';
import { TitleBar } from './TitleBar';
import { Modal } from './Modal';
import { SkillParameterModal } from './SkillParameterModal';
import { NewSessionModal } from './NewSessionModal';
import { BrowserViewer } from './BrowserViewer';
import { TodoPanel } from './TodoPanel';
import { LoginScreen } from './LoginScreen';
import { SkillBuilderProvider, SkillBuilderView } from '../skill-builder';
import '../skill-builder/styles/skill-builder.css';
import { CronJobsView } from './CronJobs/CronJobsView';
import { CronJobsProvider } from '../contexts/CronJobsContext';
import { ConnectorsView } from './Connectors';
import { ConnectorsProvider } from '../contexts/ConnectorsContext';
import { AppsManager } from './AppsManager';
import { AppViewer } from './AppViewer';
import { SSEClient } from '../utils/sseClient';
import { contextExtractor } from '../utils/contextExtractor';
import { UploadService, validateFile } from '../utils/uploadService';
import { extractUserNameFromToken } from '../utils/jwtUtils';
import { useOAuthCallback, OAuthResult } from '../hooks/useOAuthCallback';
import { useOptionalAuth, AuthUser } from '../contexts/AuthContext';
import type { MavenWidgetConfig, Message, ChatState, Skill, BrowserSession, SessionSummary, FileAttachment, FileAttachmentRef, App } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface ChatWidgetProps {
  config: MavenWidgetConfig;
  onSidebarWidthChange?: (width: number) => void;
  onWidgetOpenChange?: (isOpen: boolean) => void;
  useBuiltinAuth?: boolean;
}

export function ChatWidget({ config, onSidebarWidthChange, onWidgetOpenChange, useBuiltinAuth }: ChatWidgetProps) {
  // Auth state for built-in auth mode - use optional hook that returns null when not in AuthProvider
  const auth = useOptionalAuth();
  const [state, setState] = useState<ChatState>(() => {
    // Load state from localStorage with error handling for iOS browsers
    try {
      const saved = localStorage.getItem('maven-widget-state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            messages: parsed.messages || [],
            isOpen: false,
            isLoading: false,
            sessionId: parsed.sessionId || null,
            selectedSkills: [],
            context: null,
            error: null,
            sidebarWidth: parsed.sidebarWidth || 450,
            showScrollButton: false,
            browserSession: null,
            isBrowserViewerOpen: false,
            isBrowserViewerExpanded: false,
            todos: [],
          };
        } catch (e) {
          console.error('[Maven Widget] Failed to parse saved state:', e);
        }
      }
    } catch (e) {
      console.warn('[Maven Widget] localStorage unavailable (may be in Private Browsing):', e);
    }
    return {
      messages: [],
      isOpen: false,
      isLoading: false,
      sessionId: null,
      selectedSkills: [],
      context: null,
      error: null,
      sidebarWidth: 450,
      showScrollButton: false,
      browserSession: null,
      isBrowserViewerOpen: false,
      isBrowserViewerExpanded: false,
      todos: [],
    };
  });

  const [progressStatus, setProgressStatus] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [agentUrl, setAgentUrl] = useState<string | null>(config.agentUrl || null);
  const [browserFrame, setBrowserFrame] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showSkillParamModal, setShowSkillParamModal] = useState<boolean>(false);
  const [selectedSkillForParams, setSelectedSkillForParams] = useState<Skill | null>(null);
  const [showNewSessionModal, setShowNewSessionModal] = useState<boolean>(false);
  const [showSkillsModal, setShowSkillsModal] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>(window.location.href);

  // Session sidebar state
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [isReloadingSession, setIsReloadingSession] = useState<boolean>(false);
  // On mobile, always start with sidebar collapsed
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return window.innerWidth <= 768;
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [widgetMode, setWidgetMode] = useState<'manager' | 'tasks'>('manager');
  const [activeApp, setActiveApp] = useState<App | null>(null);

  // Skill Builder state
  const [showSkillBuilder, setShowSkillBuilder] = useState<boolean>(false);
  const [skillBuilderSkillId, setSkillBuilderSkillId] = useState<string | null>(null);

  // Cron Jobs state
  const [showCronJobs, setShowCronJobs] = useState<boolean>(false);


  // Connectors state
  const [showConnectors, setShowConnectors] = useState<boolean>(false);

  // User name extracted from JWT token
  const [tokenUserName, setTokenUserName] = useState<string | null>(null);

  // File attachment state
  const [pendingAttachments, setPendingAttachments] = useState<FileAttachment[]>([]);

  // OAuth auto-retry state - tracks retry attempts to prevent infinite loops
  const oauthRetryCountRef = useRef<number>(0);
  const MAX_OAUTH_RETRIES = 1;

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [widgetRect, setWidgetRect] = useState<DOMRect | null>(null);

  const apiUrl = config.apiUrl || window.location.origin;

  // Track URL changes for relevant skills detection
  useEffect(() => {
    const updateUrl = () => {
      setCurrentUrl(window.location.href);
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', updateUrl);

    // Listen for pushState/replaceState (SPA navigation)
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(...args) {
      originalPushState.apply(window.history, args);
      updateUrl();
    };

    window.history.replaceState = function(...args) {
      originalReplaceState.apply(window.history, args);
      updateUrl();
    };

    return () => {
      window.removeEventListener('popstate', updateUrl);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, []);

  // Discover agent URL on mount (skip if already provided via config)
  useEffect(() => {
    if (config.agentUrl) {
      console.log('[Maven Widget] Using configured agent URL:', config.agentUrl);
      return;
    }

    async function discoverAgentUrl() {
      try {
        const response = await fetch(`${apiUrl}/api/widget/${config.tenantSlug}/agent-url`);
        if (response.ok) {
          const data = await response.json();
          setAgentUrl(data.agentUrl);
          console.log('[Maven Widget] Discovered agent URL:', data.agentUrl);
        } else {
          console.warn('[Maven Widget] Failed to discover agent URL, falling back to admin');
        }
      } catch (error) {
        console.error('[Maven Widget] Error discovering agent URL:', error);
      }
    }
    discoverAgentUrl();
  }, [apiUrl, config.tenantSlug, config.agentUrl]);

  // NOTE: Visual Viewport API code removed - using CSS-only approach (Casper strategy)
  // The mobile viewport is now handled purely via CSS using:
  // - position: fixed with top/left/right/bottom: 0
  // - height: 100dvh + 100% fallback pattern
  // - min/max height locking with !important
  // This avoids Shadow DOM viewport unit bugs in Safari

  // Debug logging - only once on mount
  useEffect(() => {
    // Debug URLs for troubleshooting (only when query param ?maven_debug=1 present)
    if (window.location.search.includes('maven_debug=1')) {
      console.log('[Maven Widget] API URL (admin):', apiUrl);
      console.log('[Maven Widget] Agent URL:', agentUrl);
      console.log('[Maven Widget] Config API URL:', config.apiUrl);
      console.log('[Maven Widget] Window origin:', window.location.origin);
    }
  }, []); // Empty deps = run once on mount

  // Use agent URL if available, otherwise fall back to admin API URL
  const chatEndpoint = agentUrl || apiUrl;

  // Memoize token getter function to prevent recreating on every render
  // When using built-in auth, use the auth context's getToken
  const getToken = useMemo(() => {
    if (useBuiltinAuth && auth) {
      return auth.getToken;
    }
    return config.getToken || (config.token ? async () => config.token! : undefined);
  }, [useBuiltinAuth, auth, config.getToken, config.token]);

  // Extract user name from JWT token on mount, or use auth user when in built-in auth mode
  useEffect(() => {
    // If userName is provided in config, use that instead of extracting from token
    if (config.userName) {
      setTokenUserName(config.userName);
      return;
    }

    // When using built-in auth, use the auth context user info
    if (useBuiltinAuth && auth?.user) {
      // Use email prefix as display name
      const emailName = auth.user.email?.split('@')[0];
      setTokenUserName(emailName || null);
      return;
    }

    // Try to extract from token
    if (getToken) {
      getToken().then((token) => {
        if (token) {
          const name = extractUserNameFromToken(token);
          if (name) {
            setTokenUserName(name);
          }
        }
      }).catch((e) => {
        console.warn('[Maven Widget] Failed to get token for user name extraction:', e);
      });
    }
  }, [getToken, config.userName, useBuiltinAuth, auth?.user]);

  // Use ref for sseClient to avoid circular dependency in useCallback hooks
  const sseClientRef = useRef<SSEClient | null>(null);

  // Initialize and update sseClient when dependencies change
  useEffect(() => {
    sseClientRef.current = new SSEClient(chatEndpoint, getToken, config.userId);
  }, [chatEndpoint, getToken, config.userId]);

  // Initialize upload service (memoized to avoid recreating on every render)
  const uploadService = useMemo(() => {
    return new UploadService(apiUrl, config.tenantSlug, getToken);
  }, [apiUrl, config.tenantSlug, getToken]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    try {
      const stateToSave = {
        messages: state.messages,
        sessionId: state.sessionId,
        sidebarWidth: state.sidebarWidth,
      };
      localStorage.setItem('maven-widget-state', JSON.stringify(stateToSave));
    } catch (e) {
      // localStorage may be unavailable in Private Browsing mode on iOS
      console.warn('[Maven Widget] Failed to save state to localStorage:', e);
    }
  }, [state.messages, state.sessionId, state.sidebarWidth]);

  // Fetch sessions when widget opens and SSE client is ready
  // Also fetch if we have a restored sessionId (widget was open before reload)
  useEffect(() => {
    const shouldFetchSessions = state.isOpen || state.sessionId;
    if (!shouldFetchSessions) return;

    // Small delay to ensure SSE client is initialized
    const timeoutId = setTimeout(async () => {
      if (!sseClientRef.current) {
        console.log('[Maven Widget] SSE client not ready yet');
        return;
      }

      console.log('[Maven Widget] Fetching sessions...');
      setIsLoadingSessions(true);
      try {
        const response = await sseClientRef.current.fetchSessions();
        console.log('[Maven Widget] Sessions response:', response);
        if (!response.error) {
          setSessions(response.sessions);
          console.log('[Maven Widget] Set sessions:', response.sessions.length);
        } else {
          console.error('[Maven Widget] Sessions error:', response.error);
        }
      } catch (error) {
        console.error('[Maven Widget] Failed to fetch sessions:', error);
      } finally {
        setIsLoadingSessions(false);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [state.isOpen, chatEndpoint]);

  // Notify sidebar width on mount if widget is already open
  useEffect(() => {
    if (state.isOpen) {
      if (onWidgetOpenChange) {
        onWidgetOpenChange(true);
      }
      if (onSidebarWidthChange) {
        onSidebarWidthChange(state.sidebarWidth);
      }
    }
  }, []); // Only run on mount

  const toggleChat = useCallback(() => {
    setState((prev) => {
      const willBeOpen = !prev.isOpen;

      // Notify about widget open state change
      if (onWidgetOpenChange) {
        onWidgetOpenChange(willBeOpen);
      }

      // Notify about sidebar width when opening
      if (willBeOpen && onSidebarWidthChange) {
        onSidebarWidthChange(prev.sidebarWidth);
      }

      return { ...prev, isOpen: willBeOpen };
    });

    // Add greeting message on first open
    if (!state.isOpen && state.messages.length === 0 && config.greeting) {
      const greetingMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: config.greeting,
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [greetingMessage],
      }));
    }
  }, [state.isOpen, state.messages.length, config.greeting, onSidebarWidthChange, onWidgetOpenChange]);

  const clearSession = useCallback(() => {
    setShowClearModal(true);
  }, []);

  const handleClearConfirm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      sessionId: null,
      error: null,
    }));

    try {
      localStorage.removeItem('maven-widget-state');
    } catch (e) {
      console.warn('[Maven Widget] Failed to clear localStorage:', e);
    }

    // Add greeting message after clearing
    if (config.greeting) {
      const greetingMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: config.greeting,
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [greetingMessage],
      }));
    }

    setShowClearModal(false);
  }, [config.greeting]);

  const handleClearCancel = useCallback(() => {
    setShowClearModal(false);
  }, []);

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = state.sidebarWidth;
    document.body.classList.add('maven-resizing');
  }, [state.sidebarWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = resizeStartX.current - e.clientX; // Reversed because we're dragging from the left edge
    const newWidth = Math.min(
      Math.max(resizeStartWidth.current + deltaX, 300), // Min width: 300px
      800 // Max width: 800px
    );

    setState((prev) => ({ ...prev, sidebarWidth: newWidth }));

    // Update DOM via callback
    if (onSidebarWidthChange) {
      onSidebarWidthChange(newWidth);
    }
  }, [isResizing, onSidebarWidthChange]);

  const handleResizeEnd = useCallback(() => {
    if (!isResizing) return;
    setIsResizing(false);
    document.body.classList.remove('maven-resizing');
  }, [isResizing]);

  // Add/remove resize event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrolledFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setState((prev) => ({
      ...prev,
      showScrollButton: scrolledFromBottom > 100,
    }));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesContainerRef.current?.scrollTo({
      top: messagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const getLastUserMessage = useCallback((): string | null => {
    const userMessages = state.messages.filter(m => m.role === 'user');
    return userMessages.length > 0 ? userMessages[userMessages.length - 1].content : null;
  }, [state.messages]);

  // File attachment handlers
  const handleAddFiles = useCallback(async (files: File[]) => {
    // Limit to 5 files total
    const maxFiles = 5;
    const currentCount = pendingAttachments.length;
    const filesToAdd = files.slice(0, maxFiles - currentCount);

    if (filesToAdd.length === 0) {
      console.warn('[Maven Widget] Maximum 5 files allowed');
      return;
    }

    // Create attachment entries with pending status
    const newAttachments: FileAttachment[] = await Promise.all(
      filesToAdd.map(async (file) => {
        const error = validateFile(file);
        const isImage = file.type.startsWith('image/');

        // Generate preview for images
        let previewUrl: string | undefined;
        if (isImage && !error) {
          try {
            previewUrl = await UploadService.createPreviewUrl(file);
          } catch (e) {
            console.warn('[Maven Widget] Failed to create preview:', e);
          }
        }

        return {
          id: uuidv4(),
          file,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          previewUrl,
          uploadStatus: error ? 'error' : 'pending',
          uploadProgress: 0,
          error: error || undefined,
        } as FileAttachment;
      })
    );

    // Add to state
    setPendingAttachments((prev) => [...prev, ...newAttachments]);

    // Start uploading valid files
    for (const attachment of newAttachments) {
      if (attachment.uploadStatus === 'pending') {
        // Mark as uploading
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === attachment.id ? { ...a, uploadStatus: 'uploading' } : a
          )
        );

        try {
          const result = await uploadService.uploadAttachment(
            attachment.file,
            state.sessionId || undefined,
            (progress) => {
              setPendingAttachments((prev) =>
                prev.map((a) =>
                  a.id === attachment.id ? { ...a, uploadProgress: progress.percent } : a
                )
              );
            }
          );

          // Mark as uploaded with S3 key
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, uploadStatus: 'uploaded', uploadProgress: 100, s3Key: result.s3Key }
                : a
            )
          );
        } catch (error) {
          console.error('[Maven Widget] Upload failed:', error);
          setPendingAttachments((prev) =>
            prev.map((a) =>
              a.id === attachment.id
                ? { ...a, uploadStatus: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
                : a
            )
          );
        }
      }
    }
  }, [pendingAttachments.length, uploadService, state.sessionId]);

  const handleRemoveFile = useCallback((id: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const sendMessage = useCallback(async (message: string, attachments?: FileAttachmentRef[], skill?: Skill, parameters?: Record<string, any>, forceNewSession?: boolean) => {
    console.log('[Maven Widget] sendMessage called:', { message, skill: skill?.name, forceNewSession });

    // If forcing new session, clear state and localStorage first
    if (forceNewSession) {
      console.log('[Maven Widget] Forcing new session, clearing state');
      setState((prev) => ({
        ...prev,
        messages: [],
        sessionId: null,
        error: null,
      }));
      try {
        localStorage.removeItem('maven-widget-state');
      } catch (e) {
        console.warn('[Maven Widget] Failed to clear localStorage:', e);
      }
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
      status: 'sending',
      attachments,  // Include attachments in user message
      ...(skill && {
        skill: {
          id: skill.id,
          name: skill.name,
          slug: skill.slug,
          emoji: skill.emoji,
          parameters,
        },
      }),
    };

    // Clear pending attachments after sending
    if (attachments && attachments.length > 0) {
      setPendingAttachments([]);
    }

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    setProgressStatus('');

    // Start timer
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      // Extract page context
      const context = contextExtractor.extractPageContext();

      // Build request - use forceNewSession to override stale closure
      const isNewSession = forceNewSession || state.sessionId === null;
      const request = {
        message,
        sessionId: forceNewSession ? undefined : (state.sessionId || undefined),
        isNewSession, // Tell agent to skip resume attempt
        context,
        userId: config.userId,
        tenantSlug: config.tenantSlug,
        role: config.role,
        pagePattern: config.pagePattern,
        attachments,  // Include file attachments
        ...(skill && {
          skill: {
            slug: skill.slug,
            name: skill.name,
            parameters,
          },
        }),
      };

      let assistantContent = '';
      let currentSessionId = forceNewSession ? null : state.sessionId;
      const wasNewSession = isNewSession;

      // Streaming state updates - use flushSync to bypass React 18's automatic batching
      // This ensures each chunk renders immediately for true character-by-character streaming
      let pendingUpdate = false;
      let lastUpdateTime = 0;
      const BATCH_INTERVAL_MS = 16; // ~60fps - balance between smoothness and performance

      const flushContentUpdate = (forceSync = false) => {
        if (!pendingUpdate) return;
        pendingUpdate = false;

        const updateFn = () => {
          setState((prev) => {
            const messages = [...prev.messages];
            const lastMessage = messages[messages.length - 1];

            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = assistantContent;
            } else {
              messages.push({
                id: uuidv4(),
                role: 'assistant',
                content: assistantContent,
                timestamp: new Date(),
              });
            }

            return { ...prev, messages };
          });
        };

        // Use flushSync during active streaming to bypass React's batching
        // This ensures text appears immediately instead of being batched
        if (forceSync) {
          flushSync(updateFn);
        } else {
          updateFn();
        }
      };

      try {
        // Stream response
        for await (const event of sseClientRef.current!.streamChat(request)) {
          if (event.event === 'session') {
            currentSessionId = event.data.sessionId;
            setState((prev) => ({ ...prev, sessionId: currentSessionId }));

            // Add new session to sidebar immediately
            if (wasNewSession && currentSessionId) {
              const now = new Date().toISOString();
              const newSession: SessionSummary = {
                sessionId: currentSessionId,
                lastMessage: message.slice(0, 100), // Preview from user's message
                createdAt: now,
                updatedAt: now,
                messageCount: 1,
                totalCostUsd: 0,
                status: 'active',
              };
              setSessions((prev) => [newSession, ...prev]);
            }
          } else if (event.event === 'chunk') {
            console.log('[Maven Widget] Received chunk:', event.data.text?.slice(0, 30));
            assistantContent += event.data.text;
            pendingUpdate = true;

            // Force immediate update on every chunk for debugging
            // TODO: Re-enable batching once streaming is confirmed working
            flushSync(() => {
              setState((prev) => {
                const messages = [...prev.messages];
                const lastMessage = messages[messages.length - 1];

                if (lastMessage && lastMessage.role === 'assistant') {
                  lastMessage.content = assistantContent;
                } else {
                  messages.push({
                    id: uuidv4(),
                    role: 'assistant',
                    content: assistantContent,
                    timestamp: new Date(),
                  });
                }

                return { ...prev, messages };
              });
            });
            pendingUpdate = false;
          } else if (event.event === 'progress') {
            // Format progress status with tool name if available
            const { tool, status } = event.data;
            if (tool && status === 'executing') {
              setProgressStatus(`Working with ${tool}`);
            } else {
              setProgressStatus(status || '');
            }
          } else if (event.event === 'browser_session') {
            // Browser tool returned session info - show live view
            const browserSession: BrowserSession = event.data;
            console.log('[Maven Widget] Browser session started:', browserSession);
            setState((prev) => ({
              ...prev,
              browserSession,
              isBrowserViewerOpen: true,
            }));
          } else if (event.event === 'browser_frame') {
            // Browser tool sent a screenshot frame
            const frame = event.data;
            if (frame?.image) {
              setBrowserFrame(frame.image);
            }
          } else if (event.event === 'file_available') {
            // File created by Claude Code - add to current message for download
            const fileRef = event.data;
            console.log('[Maven Widget] File available for download:', fileRef);
            setState((prev) => {
              const messages = [...prev.messages];
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.files = [...(lastMessage.files || []), fileRef];
              }
              return { ...prev, messages };
            });
          } else if (event.event === 'session_title') {
            // Session title generated by AI - update sidebar in real-time
            const { sessionId, title } = event.data;
            console.log('[Maven Widget] Session title generated:', title);
            setSessions((prev) =>
              prev.map((s) => (s.sessionId === sessionId ? { ...s, title } : s))
            );
          } else if (event.event === 'oauth_required') {
            // OAuth authorization required for MCP tool - add to current message
            const oauthData = event.data;
            console.log('[Maven Widget] OAuth required:', oauthData);
            setState((prev) => {
              const messages = [...prev.messages];
              const lastMessage = messages[messages.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                lastMessage.oauthRequired = oauthData;
              } else {
                // Create new assistant message with OAuth requirement
                messages.push({
                  id: uuidv4(),
                  role: 'assistant',
                  content: '',
                  timestamp: new Date(),
                  oauthRequired: oauthData,
                });
              }
              return { ...prev, messages };
            });
          } else if (event.event === 'todos') {
            // Todo list update from agent
            const todoData = event.data;
            if (todoData.todos) {
              setState((prev) => ({ ...prev, todos: todoData.todos }));
            }
          } else if (event.event === 'widget') {
            // Widget from MCP connector - render immediately at top of message
            const widgetData = event.data;
            console.log('[Maven Widget] Widget received:', widgetData);
            // Flush any pending content first to ensure assistant message exists
            flushContentUpdate(true);
            setState((prev) => {
              const messages = [...prev.messages];
              let lastMessage = messages[messages.length - 1];
              // Create assistant message if it doesn't exist yet
              if (!lastMessage || lastMessage.role !== 'assistant') {
                lastMessage = {
                  id: uuidv4(),
                  role: 'assistant',
                  content: '',
                  timestamp: new Date(),
                  widgets: [],
                };
                messages.push(lastMessage);
              }
              lastMessage.widgets = [...(lastMessage.widgets || []), widgetData];
              return { ...prev, messages };
            });
          } else if (event.event === 'done') {
            // Flush any pending content before marking as done
            flushContentUpdate();
            stopTimer();
            setState((prev) => ({ ...prev, isLoading: false, todos: [] }));
            setProgressStatus('');
          } else if (event.event === 'cancelled') {
            console.log('[Maven Widget] Request cancelled');
            stopTimer();
            setState((prev) => ({ ...prev, isLoading: false, todos: [] }));
            setProgressStatus('');
            return; // Exit the stream processing
          } else if (event.event === 'error') {
            throw new Error(event.data.message || event.data.error);
          }
        }
      } finally {
        // Flush any pending content and clear loading state when stream ends
        flushContentUpdate();
        stopTimer();
        setState((prev) => ({ ...prev, isLoading: false }));
        setProgressStatus('');
      }

      // Mark user message as sent
      setState((prev) => {
        const messages = [...prev.messages];
        const userMsgIndex = messages.findIndex((m) => m.id === userMessage.id);
        if (userMsgIndex >= 0) {
          messages[userMsgIndex].status = 'sent';
        }
        return { ...prev, messages };
      });
    } catch (error: any) {
      // Don't show error if request was cancelled by user
      if (error.name === 'AbortError') {
        console.log('[Maven Widget] Request cancelled by user');
        stopTimer();
        setState((prev) => ({ ...prev, isLoading: false }));
        setProgressStatus('');
        return;
      }

      console.error('Chat error:', error);

      stopTimer();
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message,
      }));

      // Mark user message as error
      setState((prev) => {
        const messages = [...prev.messages];
        const userMsgIndex = messages.findIndex((m) => m.id === userMessage.id);
        if (userMsgIndex >= 0) {
          messages[userMsgIndex].status = 'error';
        }
        return { ...prev, messages };
      });

      // Add error message
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}`,
        timestamp: new Date(),
      };

      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));

      setProgressStatus('');
    }
  }, [state.sessionId, config, stopTimer]);

  // OAuth callback handlers for auto-retry on session expiration
  const handleOAuthSuccess = useCallback((result: OAuthResult) => {
    console.log('[Maven Widget] OAuth success:', result);
    // Reset retry count on success
    oauthRetryCountRef.current = 0;

    // Add a system message to show authorization was successful
    const successMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '✓ Authorization successful! You can now continue with your request.',
      timestamp: new Date(),
    };
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, successMessage],
    }));
  }, []);

  const handleOAuthError = useCallback((result: OAuthResult) => {
    console.log('[Maven Widget] OAuth error:', result);

    // Check if this is a retriable error (session expired) and we haven't exceeded retry limit
    if (result.retryable && oauthRetryCountRef.current < MAX_OAUTH_RETRIES) {
      oauthRetryCountRef.current += 1;
      console.log('[Maven Widget] OAuth session expired, auto-retrying... (attempt', oauthRetryCountRef.current, ')');

      // Add a message to indicate retry is happening
      const retryMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Authorization session timed out. Retrying automatically...',
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, retryMessage],
      }));

      // Send a message to the agent to retry the last action with force authentication
      // The agent will receive this and trigger a new OAuth flow
      sendMessage('Please retry the authorization - the previous session expired. [_force_authentication=true]');
    } else {
      // Max retries exceeded or non-retriable error - show error to user
      oauthRetryCountRef.current = 0; // Reset for future attempts

      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: result.error || 'Authorization failed. Please try again.',
        timestamp: new Date(),
      };
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, errorMessage],
      }));
    }
  }, [sendMessage]);

  // Listen for OAuth callback results (from popup postMessage or URL fragment)
  useOAuthCallback({
    onSuccess: handleOAuthSuccess,
    onError: handleOAuthError,
  });

  const toggleSkill = useCallback((skillId: string) => {
    console.log('[Maven Widget] toggleSkill called with skillId:', skillId);

    // Find the skill
    const skill = config.skills?.find(s => s.id === skillId);
    console.log('[Maven Widget] Found skill:', skill?.name || 'NOT FOUND');

    if (!skill) {
      console.log('[Maven Widget] Skill not found, returning early');
      return;
    }

    // Close skills modal if open
    console.log('[Maven Widget] Closing skills modal');
    setShowSkillsModal(false);

    // Check if skill has variables that need to be collected
    if (skill.variables && skill.variables.length > 0) {
      console.log('[Maven Widget] Skill has variables, showing param modal');
      // Show parameter collection modal - will create new session when submitted
      setSelectedSkillForParams(skill);
      setShowSkillParamModal(true);
    } else {
      // No parameters needed, send directly with forceNewSession=true
      console.log('[Maven Widget] No variables, sending skill message directly');
      const skillMessage = `Use skill '${skill.slug}'`;
      console.log('[Maven Widget] Skill message:', skillMessage);
      sendMessage(skillMessage, undefined, skill, undefined, true);
      console.log('[Maven Widget] sendMessage called');
      // Collapse sidebar when starting new session via skill
      setSidebarCollapsed(true);
    }
  }, [config.skills, sendMessage]);

  const handleSkillParametersSubmit = useCallback((parameters: Record<string, any>) => {
    if (!selectedSkillForParams) return;

    // Build message with natural language format
    let skillMessage = `Use skill '${selectedSkillForParams.slug}'`;

    // Add parameters if provided
    if (Object.keys(parameters).length > 0) {
      const paramsList = Object.entries(parameters)
        .map(([key, value]) => `${key}="${value}"`)
        .join(', ');
      skillMessage += ` with ${paramsList}`;
    }

    // Send message with skill and parameters, forceNewSession=true to create new session
    sendMessage(skillMessage, undefined, selectedSkillForParams, parameters, true);

    // Close modal and collapse sidebar
    setShowSkillParamModal(false);
    setSelectedSkillForParams(null);
    setSidebarCollapsed(true);
  }, [selectedSkillForParams, sendMessage]);

  const handleSkillParametersCancel = useCallback(() => {
    setShowSkillParamModal(false);
    setSelectedSkillForParams(null);
  }, []);

  // Session handlers for sidebar
  const handleSessionSelect = useCallback(async (sessionId: string) => {
    if (!sseClientRef.current || sessionId === state.sessionId) {
      return;
    }

    setLoadingSessionId(sessionId);

    try {
      const response = await sseClientRef.current.fetchHistory(sessionId);
      if (response.error) {
        console.error('[Maven Widget] Failed to load session:', response.error);
        setLoadingSessionId(null);
        return;
      }

      // Convert HistoryMessage[] to Message[] format
      const messages: Message[] = response.messages.map((msg, index) => ({
        id: `${sessionId}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        status: 'sent' as const,
      }));

      // Update state with new session and messages
      setState((prev) => ({
        ...prev,
        sessionId,
        messages,
      }));
    } catch (error) {
      console.error('[Maven Widget] Failed to load session:', error);
    } finally {
      setLoadingSessionId(null);
    }
  }, [state.sessionId]);

  const handleNewSession = useCallback(() => {
    console.log('[Maven Widget] handleNewSession called, opening modal');
    // Show modal to start new session
    setShowNewSessionModal(true);
  }, []);

  const handleNewSessionConfirm = useCallback((selectedSkill?: Skill, initialMessage?: string, attachments?: FileAttachmentRef[]) => {
    setShowNewSessionModal(false);
    // Clear any pending attachments after modal closes
    setPendingAttachments([]);

    // Collapse sidebar when starting new session from modal
    setSidebarCollapsed(true);

    // Send initial message or trigger skill - forceNewSession ensures it appears in sidebar
    if (selectedSkill) {
      toggleSkill(selectedSkill.id);
    } else if (initialMessage || (attachments && attachments.length > 0)) {
      // Pass forceNewSession=true to create new session and add to sidebar
      sendMessage(initialMessage || '(attached files)', attachments, undefined, undefined, true);
    }
  }, [toggleSkill, sendMessage]);


  // Reload current session to fetch latest messages (e.g., from cron jobs)
  const reloadSession = useCallback(async () => {
    if (!sseClientRef.current || !state.sessionId) {
      console.log('[Maven Widget] No session to reload');
      return;
    }

    setIsReloadingSession(true);

    try {
      const response = await sseClientRef.current.fetchHistory(state.sessionId);
      if (response.error) {
        console.error('[Maven Widget] Failed to reload session:', response.error);
        return;
      }

      // Convert HistoryMessage[] to Message[] format
      const messages: Message[] = response.messages.map((msg, index) => ({
        id: `${state.sessionId}-${index}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        status: 'sent' as const,
      }));

      // Update state with refreshed messages
      setState((prev) => ({
        ...prev,
        messages,
      }));

      console.log('[Maven Widget] Session reloaded with', messages.length, 'messages');
    } catch (error) {
      console.error('[Maven Widget] Failed to reload session:', error);
    } finally {
      setIsReloadingSession(false);
    }
  }, [state.sessionId]);

  const toggleBrowserViewerExpand = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isBrowserViewerExpanded: !prev.isBrowserViewerExpanded,
    }));
  }, []);

  const closeBrowserViewer = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isBrowserViewerOpen: false,
      browserSession: null,
    }));
    setBrowserFrame(null);
  }, []);

  const cancelMessage = useCallback(async () => {
    console.log('[Maven Widget] Cancelling message');

    // Abort the SSE stream
    sseClientRef.current?.abort();

    // Call server cancellation endpoint if we have a session
    if (state.sessionId) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Get fresh token for cancel request
        if (getToken) {
          const token = await getToken();
          headers['Authorization'] = `Bearer ${token}`;
        }

        await fetch(`${chatEndpoint}/cancel`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ sessionId: state.sessionId }),
        });
      } catch (error) {
        console.error('[Maven Widget] Failed to cancel on server:', error);
      }
    }

    // Update UI state
    setState((prev) => ({
      ...prev,
      isLoading: false,
    }));
    setProgressStatus('');
  }, [state.sessionId, chatEndpoint, getToken]);

  // Keyboard shortcuts (ESC to cancel, ⌘K to open new conversation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to cancel message
      if (e.key === 'Escape' && state.isLoading) {
        cancelMessage();
      }

      // ⌘K (Mac) or Ctrl+K (Windows/Linux) to open new conversation modal
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (state.isOpen && !showNewSessionModal) {
          setShowNewSessionModal(true);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [state.isLoading, state.isOpen, showNewSessionModal, cancelMessage]);

  // Auto-scroll to bottom when widget opens + collapse sidebar on mobile
  useEffect(() => {
    if (state.isOpen) {
      // On mobile, always collapse sidebar when opening widget
      if (window.innerWidth <= 768) {
        setSidebarCollapsed(true);
      }

      if (messagesContainerRef.current) {
        // Use setTimeout to ensure DOM has rendered
        setTimeout(() => {
          messagesContainerRef.current?.scrollTo({
            top: messagesContainerRef.current.scrollHeight,
            behavior: 'instant',
          });
        }, 0);
      }
    }
  }, [state.isOpen]);

  // Update widget rect when browser viewer opens
  useEffect(() => {
    if (state.isBrowserViewerOpen && chatWindowRef.current) {
      setWidgetRect(chatWindowRef.current.getBoundingClientRect());
    }
  }, [state.isBrowserViewerOpen]);

  // When using built-in auth, show login screen if not authenticated
  // Only check after initial auth loading is complete
  if (useBuiltinAuth && auth && !auth.isLoading && !auth.isAuthenticated) {
    return (
      <div className={`maven-widget-container ${state.isOpen ? 'widget-open' : ''}`}>
        {/* Chat Button - Opens sidebar */}
        {!state.isOpen && (
          <button
            className="maven-chat-button"
            onClick={toggleChat}
            aria-label="Open chat"
          >
            {config.avatar ? (
              <img src={config.avatar} alt="Chat" className="maven-chat-button-logo" />
            ) : (
              <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="40" y="50" width="120" height="110" rx="25" fill="#0a1628"/>
                <polygon points="50,50 40,20 70,45" fill="#0a1628"/>
                <polygon points="150,50 160,20 130,45" fill="#0a1628"/>
                <circle cx="72" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
                <circle cx="72" cy="95" r="12" fill="#0a1628"/>
                <circle cx="76" cy="91" r="4" fill="#faf8f5"/>
                <circle cx="128" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
                <circle cx="128" cy="95" r="12" fill="#0a1628"/>
                <circle cx="132" cy="91" r="4" fill="#faf8f5"/>
                <line x1="97" y1="95" x2="103" y2="95" stroke="#0a1628" strokeWidth="5" strokeLinecap="round"/>
                <path d="M100 118 L92 135 L100 148 L108 135 Z" fill="#e07856"/>
              </svg>
            )}
          </button>
        )}

        {/* Chat Window - Login Screen */}
        <div
          ref={chatWindowRef}
          className={`maven-chat-window sidebar-mode ${state.isOpen ? 'open' : ''}`}
          style={{ width: `${state.sidebarWidth}px` }}
        >
          {/* Resize Handle */}
          <div
            className={`maven-resize-handle ${isResizing ? 'resizing' : ''}`}
            onMouseDown={handleResizeStart}
            role="separator"
            aria-label="Resize sidebar"
          />

          {/* Title Bar with close button only */}
          <div className="maven-title-bar">
            <div className="maven-title-bar-left">
              <button
                className="maven-title-bar-button close"
                onClick={toggleChat}
                aria-label="Close"
              />
            </div>
            <div className="maven-title-bar-center">
              <span className="maven-title-bar-title">Sign In</span>
            </div>
            <div className="maven-title-bar-right" />
          </div>

          {/* Login Screen */}
          <LoginScreen
            title={config.title}
            subtitle={config.subtitle}
            avatar={config.avatar}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`maven-widget-container ${state.isOpen ? 'widget-open' : ''}`}>
      {/* Chat Button - Opens sidebar */}
      {!state.isOpen && (
        <button
          className="maven-chat-button"
          onClick={toggleChat}
          aria-label="Open chat"
        >
          {config.avatar ? (
            <img src={config.avatar} alt="Chat" className="maven-chat-button-logo" />
          ) : (
            <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="40" y="50" width="120" height="110" rx="25" fill="#0a1628"/>
              <polygon points="50,50 40,20 70,45" fill="#0a1628"/>
              <polygon points="150,50 160,20 130,45" fill="#0a1628"/>
              <circle cx="72" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
              <circle cx="72" cy="95" r="12" fill="#0a1628"/>
              <circle cx="76" cy="91" r="4" fill="#faf8f5"/>
              <circle cx="128" cy="95" r="25" fill="#faf8f5" stroke="#0a1628" strokeWidth="4"/>
              <circle cx="128" cy="95" r="12" fill="#0a1628"/>
              <circle cx="132" cy="91" r="4" fill="#faf8f5"/>
              <line x1="97" y1="95" x2="103" y2="95" stroke="#0a1628" strokeWidth="5" strokeLinecap="round"/>
              <path d="M100 118 L92 135 L100 148 L108 135 Z" fill="#e07856"/>
            </svg>
          )}
        </button>
      )}

      {/* Chat Window - Always Sidebar Mode */}
      <div
        ref={chatWindowRef}
        className={`maven-chat-window sidebar-mode ${state.isOpen ? 'open' : ''} ${isFullscreen ? 'fullscreen' : ''}`}
        style={{ width: `${state.sidebarWidth}px` }}
      >
        {/* Resize Handle - Always visible in sidebar mode */}
        <div
          className={`maven-resize-handle ${isResizing ? 'resizing' : ''}`}
          onMouseDown={handleResizeStart}
          role="separator"
          aria-label="Resize sidebar"
        />

        {/* Title Bar - macOS style */}
        <TitleBar
          mode={widgetMode}
          onModeChange={(newMode) => {
            setShowSkillBuilder(false);
            setShowCronJobs(false);
            setShowConnectors(false);
            setWidgetMode(newMode);
          }}
          onClose={toggleChat}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          onSkillsClick={() => {
            setShowCronJobs(false);
            setShowConnectors(false);
            setShowSkillBuilder(true);
          }}
          onSchedulesClick={() => {
            setShowSkillBuilder(false);
            setShowConnectors(false);
            setShowCronJobs(true);
          }}
          onConnectorsClick={() => {
            setShowSkillBuilder(false);
            setShowCronJobs(false);
            setShowConnectors(true);
          }}
          showSkills={showSkillBuilder}
          showSchedules={showCronJobs}
          showConnectors={showConnectors}
        />

        {/* Main Layout - Vertical Split with Footer */}
        <div className="maven-widget-layout">
          {widgetMode === 'manager' ? (
            /* Manager View - Apps */
            <div className="maven-manager-view">
              {activeApp ? (
                <AppViewer
                  app={activeApp}
                  tenantId={config.tenantId || ''}
                  tenantSlug={config.tenantSlug}
                  apiUrl={apiUrl}
                  agentUrl={agentUrl || undefined}
                  userId={config.userId}
                  getToken={config.getToken}
                  onClose={() => setActiveApp(null)}
                  onNavigateToConnectors={() => {
                    setActiveApp(null);
                    setShowConnectors(true);
                  }}
                />
              ) : (
                <AppsManager
                  tenantId={config.tenantId || ''}
                  tenantSlug={config.tenantSlug}
                  userId={config.userId}
                  userRole={config.role}
                  apiUrl={apiUrl}
                  getToken={config.getToken}
                  onAppSelect={setActiveApp}
                />
              )}
            </div>
          ) : (
            /* Tasks View - Sidebar + Chat */
            <div className="maven-widget-main">
              {/* Mobile overlay - closes sidebar when clicked */}
              {!sidebarCollapsed && (
                <div
                  className="maven-sidebar-overlay"
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Close sidebar"
                />
              )}

              {/* Session Sidebar */}
              <SessionSidebar
                sessions={sessions}
                currentSessionId={state.sessionId}
                isLoading={isLoadingSessions}
                isLoadingSession={loadingSessionId}
                collapsed={sidebarCollapsed}
                onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                userRole={config.role}
                onSkillsClick={() => {
                  setShowCronJobs(false);
                  setShowConnectors(false);
                  setShowSkillBuilder(true);
                }}
                onCronJobsClick={() => {
                  setShowSkillBuilder(false);
                  setShowConnectors(false);
                  setShowCronJobs(true);
                }}
                onConnectorsClick={() => {
                  setShowSkillBuilder(false);
                  setShowCronJobs(false);
                  setShowConnectors(true);
                }}
              />

              {/* Content Area */}
              <div className="maven-content-area">
                {/* Mobile Header - hamburger | + | skills in one row */}
                {sidebarCollapsed && (
                  <div className="maven-mobile-header">
                    <button
                      className="maven-mobile-header-btn"
                      onClick={() => setSidebarCollapsed(false)}
                      aria-label="Open menu"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" />
                        <line x1="3" y1="12" x2="21" y2="12" />
                        <line x1="3" y1="18" x2="21" y2="18" />
                      </svg>
                    </button>

                    <button
                      className="maven-mobile-header-btn maven-mobile-header-btn-new"
                      onClick={handleNewSession}
                      aria-label="New conversation"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </button>

                    {/* Skills in mobile header */}
                    {config.skills && config.skills.length > 0 && (
                      <div className="maven-mobile-header-skills">
                        <SkillsBar
                          skills={config.skills}
                          currentUrl={currentUrl}
                          onSkillClick={toggleSkill}
                          onShowMore={() => setShowSkillsModal(true)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Skills Bar - always visible on desktop, CSS hides on mobile where header skills show */}
                {config.skills && config.skills.length > 0 && (
                  <SkillsBar
                    skills={config.skills}
                    currentUrl={currentUrl}
                    onSkillClick={toggleSkill}
                    onShowMore={() => setShowSkillsModal(true)}
                  />
                )}

                {/* Messages */}
                <MessageList
                  messages={state.messages}
                  isLoading={state.isLoading}
                  progressStatus={progressStatus}
                  elapsedTime={elapsedTime}
                  avatar={config.avatar}
                  showScrollButton={state.showScrollButton}
                  onScroll={handleScroll}
                  onScrollToBottom={scrollToBottom}
                  agentUrl={agentUrl || undefined}
                  getToken={getToken}
                  apiUrl={apiUrl}
                  tenantSlug={config.tenantSlug}
                />

                {/* Todo Panel - shows above input when active */}
                <TodoPanel todos={state.todos} isLoading={state.isLoading} />

                {/* Input */}
                <InputArea
                  onSend={sendMessage}
                  disabled={state.isLoading}
                  placeholder={config.placeholder || 'Type your message...'}
                  context={state.context}
                  lastUserMessage={getLastUserMessage()}
                  attachments={pendingAttachments}
                  onAddFiles={handleAddFiles}
                  onRemoveFile={handleRemoveFile}
                  enableVoiceInput={config.enableVoiceInput ?? true}
                  enableCameraInput={config.enableCameraInput ?? true}
                />
              </div>
            </div>
          )}

          {/* Unified Footer - hidden when viewing an app */}
          {!activeApp && (
            <WidgetFooter
              collapsed={sidebarCollapsed}
              onCollapseToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              userName={tokenUserName || undefined}
            />
          )}
        </div>

        {/* Clear Session Modal */}
        <Modal
          isOpen={showClearModal}
          title="Clear Conversation"
          message="Are you sure you want to clear this conversation? This action cannot be undone."
          confirmText="Clear"
          cancelText="Cancel"
          onConfirm={handleClearConfirm}
          onCancel={handleClearCancel}
        />

        {/* Skill Parameter Collection Modal */}
        <SkillParameterModal
          isOpen={showSkillParamModal}
          skill={selectedSkillForParams}
          onSubmit={handleSkillParametersSubmit}
          onCancel={handleSkillParametersCancel}
        />

        {/* New Session Modal */}
        <NewSessionModal
          isOpen={showNewSessionModal}
          skills={config.skills}
          onConfirm={handleNewSessionConfirm}
          onCancel={() => setShowNewSessionModal(false)}
          attachments={pendingAttachments}
          onAddFiles={handleAddFiles}
          onRemoveFile={handleRemoveFile}
        />

        {/* Skills Modal */}
        <SkillsModal
          isOpen={showSkillsModal}
          onClose={() => setShowSkillsModal(false)}
          skills={config.skills || []}
          currentUrl={currentUrl}
          onSkillClick={toggleSkill}
        />

        {/* Skill Builder - Overlay within widget */}
        {showSkillBuilder && config.tenantId && getToken && (config.userId || auth?.user?.id) && config.controlPlaneUrl && (
          <div className="maven-skill-builder-overlay">
            <SkillBuilderProvider
              tenantId={config.tenantId}
              apiUrl={config.controlPlaneUrl}
              getToken={getToken}
              initialSkillId={skillBuilderSkillId || undefined}
              userId={config.userId || auth?.user?.id || ''}
            >
              <SkillBuilderView
                onClose={() => {
                  setShowSkillBuilder(false);
                  setSkillBuilderSkillId(null);
                }}
              />
            </SkillBuilderProvider>
          </div>
        )}

        {/* Cron Jobs Overlay */}
        {showCronJobs && config.tenantId && (
          <div className="maven-cronjobs-overlay">
            <CronJobsProvider
              tenantId={config.tenantId}
              adminApiUrl={apiUrl}
              getToken={getToken}
              userId={config.userId}
            >
              <CronJobsView
                onClose={() => {
                  setShowCronJobs(false);
                }}
              />
            </CronJobsProvider>
          </div>
        )}

        {/* Connectors Overlay */}
        {showConnectors && config.tenantId && config.userId && (
          <div className="maven-connectors-overlay">
            <ConnectorsProvider
              tenantId={config.tenantId}
              userId={config.userId}
              adminApiUrl={apiUrl}
              getToken={getToken}
            >
              <ConnectorsView
                onClose={() => {
                  setShowConnectors(false);
                }}
              />
            </ConnectorsProvider>
          </div>
        )}
      </div>

      {/* Browser Live View - Outside chat window for independent positioning */}
      {state.browserSession && state.isBrowserViewerOpen && (
        <BrowserViewer
          session={state.browserSession}
          currentFrame={browserFrame}
          isExpanded={state.isBrowserViewerExpanded}
          onToggleExpand={toggleBrowserViewerExpand}
          onClose={closeBrowserViewer}
          widgetRect={widgetRect}
        />
      )}
    </div>
  );
}
