/**
 * Parse response from API.
 * Supports both SSE format (data: {...}) and regular JSON responses.
 */
export async function parseSSEResponse(response: Response, _expectedType?: string): Promise<Record<string, unknown>> {
  const text = await response.text();

  // Try parsing as regular JSON first
  try {
    const data = JSON.parse(text);
    // If it's already the data object, return it
    if (typeof data === 'object' && data !== null) {
      return data;
    }
  } catch {
    // Not valid JSON, try SSE format
  }

  // Try SSE format
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const data = JSON.parse(line.slice(6));
        if (data.type === 'error') {
          throw new Error(data.data?.message || 'Unknown error');
        }
        return data.data || data;
      } catch {
        continue;
      }
    }
  }

  throw new Error('No valid data in response');
}
