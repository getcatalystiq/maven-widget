import type { PageContext } from '../types';

export class ContextExtractor {
  // Cache for extracted page context to avoid expensive DOM operations on every message
  // TTL: 30 seconds - balances freshness with performance
  private cachedContext: PageContext | null = null;
  private cacheTimestamp = 0;
  private cacheUrl = '';
  private static readonly CACHE_TTL_MS = 30_000; // 30 seconds

  extractPageContext(): PageContext {
    const currentUrl = window.location.href;
    const now = Date.now();

    // Return cached context if:
    // 1. Cache exists
    // 2. Same URL (user hasn't navigated)
    // 3. Cache is fresh (within TTL)
    if (
      this.cachedContext &&
      this.cacheUrl === currentUrl &&
      now - this.cacheTimestamp < ContextExtractor.CACHE_TTL_MS
    ) {
      return this.cachedContext;
    }

    // Cache miss or stale - extract fresh context
    const fullText = this.extractVisibleText();

    this.cachedContext = {
      url: currentUrl,
      title: document.title,
      path: window.location.pathname,
      text: fullText,
      textSample: fullText.substring(0, 1000),
      metadata: this.extractMetadata(),
    };
    this.cacheTimestamp = now;
    this.cacheUrl = currentUrl;

    return this.cachedContext;
  }

  /**
   * Invalidate the context cache. Call this when you know the page content
   * has changed significantly (e.g., after SPA navigation).
   */
  invalidateCache(): void {
    this.cachedContext = null;
    this.cacheTimestamp = 0;
    this.cacheUrl = '';
  }

  private extractVisibleText(): string {
    // Use TreeWalker for more efficient and comprehensive text extraction
    // This captures ALL visible text nodes, not just specific elements
    const textNodes: string[] = [];

    // Use function-based filter for iOS Safari compatibility
    // iOS Safari < 16 doesn't support object-based filters with acceptNode method
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      (node) => {
        // Skip if parent element is hidden
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const style = window.getComputedStyle(parent);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0'
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip script, style, noscript tags
        const tagName = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'iframe'].includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Only accept nodes with actual content
        const text = node.textContent?.trim();
        if (!text || text.length === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      const text = currentNode.textContent?.trim();
      if (text && text.length > 0) {
        textNodes.push(text);
      }
    }

    // Join with spaces and normalize whitespace
    const fullText = textNodes.join(' ').replace(/\s+/g, ' ').trim();

    // Limit to 50,000 characters (5x more than before)
    return fullText.substring(0, 50000);
  }

  private extractMetadata(): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Whitelist of safe meta tags to extract (security: prevent token/credential leakage)
    const safeMetaTags = new Set([
      'description',
      'keywords',
      'author',
      'viewport',
      'og:title',
      'og:description',
      'og:image',
      'og:type',
      'og:url',
      'twitter:card',
      'twitter:title',
      'twitter:description',
      'twitter:image',
      'theme-color',
    ]);

    // Extract meta tags (only whitelisted)
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach((tag) => {
      const name = tag.getAttribute('name') || tag.getAttribute('property');
      const content = tag.getAttribute('content');

      if (name && content && safeMetaTags.has(name)) {
        metadata[name] = content;
      }
    });

    // Add page structure info
    metadata.headingCount = document.querySelectorAll('h1, h2, h3').length;
    metadata.imageCount = document.querySelectorAll('img').length;
    metadata.linkCount = document.querySelectorAll('a').length;

    // Extract structured data (Schema.org, JSON-LD)
    try {
      const structuredDataScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      if (structuredDataScripts.length > 0) {
        const structuredData: any[] = [];
        structuredDataScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent || '');
            structuredData.push(data);
          } catch (e) {
            // Ignore malformed JSON
          }
        });
        if (structuredData.length > 0) {
          metadata.structuredData = structuredData;
        }
      }
    } catch (e) {
      // Ignore errors in structured data extraction
    }

    return metadata;
  }

  extractSelection(): string | null {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const text = selection.toString().trim();
    return text.length > 0 ? text : null;
  }

  extractFormData(): Record<string, any> | null {
    const forms = document.querySelectorAll('form');
    if (forms.length === 0) return null;

    const formData: Record<string, any> = {};

    forms.forEach((form, index) => {
      const formId = form.id || `form-${index}`;
      const fields: Record<string, string> = {};

      const inputs = form.querySelectorAll('input, select, textarea');
      inputs.forEach((input) => {
        if (input instanceof HTMLInputElement ||
            input instanceof HTMLSelectElement ||
            input instanceof HTMLTextAreaElement) {
          const name = input.name || input.id;
          if (name && input.type !== 'password') {
            fields[name] = input.value;
          }
        }
      });

      if (Object.keys(fields).length > 0) {
        formData[formId] = fields;
      }
    });

    return Object.keys(formData).length > 0 ? formData : null;
  }

  extractProductInfo(): Record<string, any> | null {
    // Try to extract e-commerce product info
    const productInfo: Record<string, any> = {};

    // Look for common product data patterns
    const priceElements = document.querySelectorAll('[class*="price"], [id*="price"]');
    if (priceElements.length > 0) {
      priceElements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && /\$|€|£/.test(text)) {
          productInfo.price = text;
        }
      });
    }

    // Look for product titles
    const h1 = document.querySelector('h1');
    if (h1) {
      productInfo.title = h1.textContent?.trim();
    }

    // Look for schema.org Product markup
    const schemaScript = document.querySelector('script[type="application/ld+json"]');
    if (schemaScript) {
      try {
        const schema = JSON.parse(schemaScript.textContent || '');
        if (schema['@type'] === 'Product') {
          productInfo.schema = schema;
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    return Object.keys(productInfo).length > 0 ? productInfo : null;
  }
}

export const contextExtractor = new ContextExtractor();
