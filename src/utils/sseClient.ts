import type { ChatRequest, SSEEvent, SessionListResponse, HistoryResponse } from '../types';

export class SSEClient {
  private apiUrl: string;
  private baseUrl: string;
  private getToken: (() => Promise<string>) | undefined;
  private userId: string | undefined;
  private abortController: AbortController | null = null;

  constructor(apiUrl: string, getToken?: () => Promise<string>, userId?: string) {
    // Ensure URL ends without trailing slash for clean concatenation
    const cleanUrl = apiUrl.replace(/\/$/, '');
    // Extract base URL for REST endpoints (remove /chat/stream or /chat suffix)
    this.baseUrl = cleanUrl.replace(/\/chat\/stream$/, '').replace(/\/chat$/, '');
    // Ensure streaming URL always points to /chat/stream
    // If URL doesn't already have /chat/stream, append it
    this.apiUrl = cleanUrl.endsWith('/chat/stream') ? cleanUrl : `${this.baseUrl}/chat/stream`;
    this.getToken = getToken;
    this.userId = userId;
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<SSEEvent> {
    this.abortController = new AbortController();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Get fresh token before making request
      if (this.getToken) {
        const token = await this.getToken();
        headers['Authorization'] = `Bearer ${token}`;
        // AgentCore Runtime forwards custom headers to containers (but not Authorization)
        // This allows the agent to pass the JWT to MCP Gateway for authentication
        headers['X-Amzn-Bedrock-AgentCore-Runtime-Custom-Authorization'] = `Bearer ${token}`;
      }

      // Pass user ID for per-user OAuth token binding in Token Vault
      // Token Vault uses (workload_identity + user_id) as the key for storing OAuth tokens
      if (this.userId) {
        headers['X-Amzn-Bedrock-AgentCore-Runtime-User-Id'] = this.userId;
        console.log('[Maven Widget] Sending User-Id header:', this.userId);
      } else {
        console.log('[Maven Widget] WARNING: No userId available for User-Id header');
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // NDJSON format: split on single newline
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            // Maven-Core NDJSON format: {"type": "content", "text": "..."}
            const parsed = JSON.parse(line);

            // Map maven-core event types to widget event types
            // Maven-Core: start, content, tool_use, done, error
            // Widget: session, chunk, progress, done, error
            let eventType: SSEEvent['event'];
            let data: any;

            switch (parsed.type) {
              case 'start':
                eventType = 'session';
                data = { sessionId: parsed.sessionId };
                console.log('[Maven Widget] Stream started:', parsed.sessionId);
                break;
              case 'content':
                // Skip final accumulated content if we've been receiving stream events
                // The stream events already provided the text incrementally
                // This event just contains the full text at the end
                console.log('[Maven Widget] Skipping final content event (already streamed)');
                continue;
              case 'stream':
                // Handle Claude Agent SDK streaming events
                // Format: {"type":"stream","event":{"type":"content_block_delta","delta":{"text":"..."}}}
                console.log('[Maven Widget] Stream event:', parsed.event?.type, parsed.event?.delta?.text?.slice(0, 20));
                if (parsed.event?.type === 'content_block_delta' && parsed.event?.delta?.text) {
                  eventType = 'chunk';
                  data = { text: parsed.event.delta.text };
                  console.log('[Maven Widget] Emitting chunk:', data.text.slice(0, 20));
                } else {
                  // Skip non-text stream events (message_start, content_block_start, etc.)
                  continue;
                }
                break;
              case 'tool_use':
                eventType = 'progress';
                data = { tool: parsed.name, status: 'executing' };
                break;
              case 'done':
                eventType = 'done';
                data = { sessionId: parsed.sessionId, usage: parsed.usage };
                break;
              case 'error':
                eventType = 'error';
                data = { message: parsed.message, error: parsed.message };
                break;
              default:
                // Pass through other event types (browser_session, file_available, etc.)
                eventType = parsed.type as SSEEvent['event'];
                data = parsed.data || parsed;
            }

            yield { event: eventType, data };
          } catch (e) {
            // Log warning for malformed lines but continue processing
            console.warn('[Maven Widget] Failed to parse NDJSON line:', line, e);
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }
      throw error;
    } finally {
      this.abortController = null;
    }
  }

  abort() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Get auth headers for REST requests
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.getToken) {
      const token = await this.getToken();
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Amzn-Bedrock-AgentCore-Runtime-Custom-Authorization'] = `Bearer ${token}`;
    }
    // Pass user ID for per-user OAuth token binding in Token Vault
    if (this.userId) {
      headers['X-Amzn-Bedrock-AgentCore-Runtime-User-Id'] = this.userId;
    }
    return headers;
  }

  /**
   * Fetch all sessions for the current user
   * Uses GET {baseUrl}/sessions endpoint
   */
  async fetchSessions(): Promise<SessionListResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('[Maven Widget] Fetching sessions via GET /sessions');

      const response = await fetch(`${this.baseUrl}/sessions`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        console.error('[Maven Widget] Sessions request failed:', response.status);
        return { sessions: [], count: 0, error: `HTTP ${response.status}` };
      }

      // Maven-Core returns JSON response
      const data = await response.json();
      console.log('[Maven Widget] Sessions data:', data);
      return {
        sessions: data.sessions || [],
        count: data.count || data.sessions?.length || 0,
      };
    } catch (error) {
      console.error('[Maven Widget] Failed to fetch sessions:', error);
      return { sessions: [], count: 0, error: String(error) };
    }
  }

  /**
   * Fetch message history for a specific session
   * Uses GET {baseUrl}/sessions/{sessionId} endpoint
   */
  async fetchHistory(sessionId: string): Promise<HistoryResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('[Maven Widget] Fetching history via GET /sessions/:id');

      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return { sessionId, messages: [], error: `HTTP ${response.status}` };
      }

      // Maven-Core returns JSON response
      const data = await response.json();
      return {
        sessionId: data.sessionId || sessionId,
        messages: data.messages || [],
      };
    } catch (error) {
      console.error('[Maven Widget] Failed to fetch history:', error);
      return { sessionId, messages: [], error: String(error) };
    }
  }
}
