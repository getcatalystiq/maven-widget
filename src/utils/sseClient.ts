import type { ChatRequest, SSEEvent, SessionListResponse, HistoryResponse } from '../types';

export class SSEClient {
  private apiUrl: string;
  private getToken: (() => Promise<string>) | undefined;
  private userId: string | undefined;
  private abortController: AbortController | null = null;

  constructor(apiUrl: string, getToken?: () => Promise<string>, userId?: string) {
    // Ensure URL ends without trailing slash for clean concatenation
    this.apiUrl = apiUrl.replace(/\/$/, '');
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
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          const dataMatch = line.match(/^data: (.+)$/m);
          if (dataMatch) {
            // BedrockAgentCore SSE format: data: {"type": "chunk", "data": {"text": "..."}}
            const parsed = JSON.parse(dataMatch[1]);
            if (parsed.type && parsed.data) {
              yield {
                event: parsed.type as SSEEvent['event'],
                data: parsed.data,
              };
            }
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
   * Parse SSE response for action-based requests (sessions, history)
   * Returns the parsed data from the first event of the expected type
   */
  private async parseActionResponse(response: Response, expectedType: string): Promise<any> {
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
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        const dataMatch = line.match(/^data: (.+)$/m);
        if (dataMatch) {
          const parsed = JSON.parse(dataMatch[1]);
          // BedrockAgentCore SSE format: {"type": "sessions", "data": {...}}
          if (parsed.type === expectedType) {
            return parsed.data;
          }
          if (parsed.type === 'error') {
            throw new Error(parsed.data?.message || 'Unknown error');
          }
        }
      }
    }

    throw new Error(`Expected ${expectedType} response not received`);
  }

  /**
   * Fetch all sessions for the current user
   * Uses /invocations endpoint with action="list_sessions"
   * AgentCore only exposes /invocations, not custom routes
   */
  async fetchSessions(): Promise<SessionListResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('[Maven Widget] Fetching sessions via invocations action');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'list_sessions',
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        console.error('[Maven Widget] Sessions request failed:', response.status);
        return { sessions: [], count: 0, error: `HTTP ${response.status}` };
      }

      // Agent returns SSE stream with type="sessions"
      const data = await this.parseActionResponse(response, 'sessions');
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
   * Uses /invocations endpoint with action="get_history"
   * AgentCore only exposes /invocations, not custom routes
   */
  async fetchHistory(sessionId: string): Promise<HistoryResponse> {
    try {
      const headers = await this.getHeaders();
      console.log('[Maven Widget] Fetching history via invocations action');

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'get_history',
          sessionId,
          userId: this.userId,
        }),
      });

      if (!response.ok) {
        return { sessionId, messages: [], error: `HTTP ${response.status}` };
      }

      // Agent returns SSE stream with type="history"
      const data = await this.parseActionResponse(response, 'history');
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
