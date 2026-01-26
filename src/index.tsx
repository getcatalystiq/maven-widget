import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';
import { AuthProvider } from './contexts/AuthContext';
import type { MavenWidgetConfig } from './types';

// Build-time defines injected by esbuild
declare const __WIDGET_CSS__: string;
declare const __WIDGET_VERSION__: string;

// Log version on load
console.log(`[Maven Widget] v${__WIDGET_VERSION__}`);

class MavenWidget extends HTMLElement {
  private shadow: ShadowRoot;
  private root: any;
  private config: MavenWidgetConfig;
  private globalStylesElement: HTMLStyleElement | null = null;
  private scrollPosition: number = 0;
  private container: HTMLElement | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private htmlClassObserver: MutationObserver | null = null;

  // Built-in auth properties
  private useBuiltinAuth: boolean = false;
  private controlPlaneUrl: string | null = null;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });

    // Parse config from attributes
    this.config = this.parseConfig();
  }

  // Get effective theme based on config, host page class, or system preference
  private getEffectiveTheme(): 'light' | 'dark' {
    const themeMode = this.config.themeMode || 'auto';

    if (themeMode === 'auto') {
      // Check host page's html class first (next-themes, etc.)
      const htmlElement = document.documentElement;
      if (htmlElement.classList.contains('dark')) {
        return 'dark';
      }
      if (htmlElement.classList.contains('light')) {
        return 'light';
      }
      // Fall back to system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    return themeMode;
  }

  // Apply theme class to container
  private applyTheme() {
    if (!this.container) return;

    const effectiveTheme = this.getEffectiveTheme();
    this.container.classList.toggle('dark', effectiveTheme === 'dark');
    this.container.classList.toggle('light', effectiveTheme === 'light');
  }

  async connectedCallback() {
    try {
      // Fetch dynamic config from API if tenant slug is provided
      await this.fetchDynamicConfig();
      this.render();
      this.injectGlobalStyles();
    } catch (error) {
      console.error('[Maven Widget] Failed to initialize widget:', error);
      // Show error in shadow DOM
      this.showError(error);
    }
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
    }
    this.removeGlobalStyles();

    // Clean up media query listener
    if (this.mediaQueryListener) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.removeEventListener('change', this.mediaQueryListener);
      this.mediaQueryListener = null;
    }

    // Clean up html class observer
    if (this.htmlClassObserver) {
      this.htmlClassObserver.disconnect();
      this.htmlClassObserver = null;
    }
  }

  private injectGlobalStyles() {
    // Create global style element if it doesn't exist
    if (!this.globalStylesElement) {
      this.globalStylesElement = document.createElement('style');
      this.globalStylesElement.id = 'maven-global-styles';
      this.globalStylesElement.textContent = `
        body.maven-sidebar-active {
          margin-right: 450px !important;
          transition: margin-right 0.3s ease-out !important;
          overflow-y: scroll !important;
        }

        html.maven-sidebar-active {
          overflow-y: scroll !important;
        }

        html.maven-sidebar-active body {
          overflow-y: visible !important;
        }

        /* Prevent body scroll on mobile when widget is open */
        @media (max-width: 768px) {
          body.maven-widget-open {
            overflow: hidden !important;
            position: fixed !important;
            width: 100% !important;
            left: 0 !important;
            right: 0 !important;
          }
        }
      `;
      document.head.appendChild(this.globalStylesElement);
    }
  }

  private removeGlobalStyles() {
    if (this.globalStylesElement && this.globalStylesElement.parentNode) {
      this.globalStylesElement.parentNode.removeChild(this.globalStylesElement);
      this.globalStylesElement = null;
    }
  }

  private updateSidebarWidth(width: number) {
    if (this.globalStylesElement) {
      this.globalStylesElement.textContent = `
        body.maven-sidebar-active {
          margin-right: ${width}px !important;
          transition: margin-right 0.3s ease-out !important;
          overflow-y: scroll !important;
        }

        html.maven-sidebar-active {
          overflow-y: scroll !important;
        }

        html.maven-sidebar-active body {
          overflow-y: visible !important;
        }
      `;
    }
    document.body.style.marginRight = `${width}px`;
  }

  public enableSidebarMode(width: number) {
    document.body.classList.add('maven-sidebar-active');
    document.documentElement.classList.add('maven-sidebar-active');
    this.updateSidebarWidth(width);
  }

  public disableSidebarMode() {
    document.body.classList.remove('maven-sidebar-active');
    document.documentElement.classList.remove('maven-sidebar-active');
    document.body.style.marginRight = '';
  }

  public setWidgetOpen(isOpen: boolean) {
    if (isOpen) {
      // Enable sidebar mode when widget opens
      this.enableSidebarMode(450); // Default width, will be updated by onSidebarWidthChange
      document.body.classList.add('maven-widget-open');
    } else {
      // Disable sidebar mode when widget closes
      this.disableSidebarMode();
      document.body.classList.remove('maven-widget-open');
    }
  }

  private showError(error: any) {
    const errorContainer = document.createElement('div');
    errorContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 16px;
      border-radius: 8px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 999999;
    `;
    // SECURITY: Build error display with safe DOM APIs to prevent XSS
    // Don't use innerHTML with untrusted error messages
    const strongEl = document.createElement('strong');
    strongEl.textContent = 'Maven Widget Error';

    const mainText = document.createTextNode('Failed to initialize. Check console for details.');

    const smallEl = document.createElement('small');
    smallEl.style.cssText = 'opacity: 0.8; margin-top: 8px; display: block;';
    // Use textContent to safely escape any HTML in error message
    smallEl.textContent = error?.message || 'Unknown error';

    errorContainer.appendChild(strongEl);
    errorContainer.appendChild(document.createElement('br'));
    errorContainer.appendChild(mainText);
    errorContainer.appendChild(document.createElement('br'));
    errorContainer.appendChild(smallEl);

    this.shadow.appendChild(errorContainer);
  }

  private parseConfig(): MavenWidgetConfig {
    const apiUrl = this.getAttribute('api-url');
    const agentUrl = this.getAttribute('agent-url');
    const avatar = this.getAttribute('avatar');
    const userId = this.getAttribute('user-id');
    const tenantId = this.getAttribute('tenant-id');
    const role = this.getAttribute('role');
    const pagePattern = this.getAttribute('page-pattern');
    const token = this.getAttribute('token');
    const themeModeAttr = this.getAttribute('theme-mode');

    // Parse built-in auth options
    const useBuiltinAuthAttr = this.getAttribute('use-builtin-auth');
    this.useBuiltinAuth = useBuiltinAuthAttr === 'true' || useBuiltinAuthAttr === '';
    this.controlPlaneUrl = this.getAttribute('control-plane-url');

    // Validate built-in auth configuration
    if (this.useBuiltinAuth) {
      if (!this.controlPlaneUrl) {
        console.error('[Maven Widget] control-plane-url is required when use-builtin-auth is enabled');
      }
      if (!tenantId) {
        console.error('[Maven Widget] tenant-id is required when use-builtin-auth is enabled');
      }
    }

    // Parse theme mode (light, dark, or auto)
    let themeMode: 'light' | 'dark' | 'auto' | undefined;
    if (themeModeAttr === 'light' || themeModeAttr === 'dark' || themeModeAttr === 'auto') {
      themeMode = themeModeAttr;
    }

    const config: MavenWidgetConfig = {
      tenantSlug: this.getAttribute('tenant-slug') || '',
      tenantId: tenantId ? tenantId : undefined,
      apiUrl: apiUrl ? apiUrl : undefined,
      agentUrl: agentUrl ? agentUrl : undefined,
      themeMode: themeMode,
      greeting: this.getAttribute('greeting') || 'Hello! How can I help you today?',
      placeholder: this.getAttribute('placeholder') || 'Type your message...',
      title: this.getAttribute('data-title') || 'Maven AI',
      subtitle: this.getAttribute('data-subtitle') || 'How can I help you?',
      avatar: avatar ? avatar : undefined,
      userId: userId ? userId : undefined,
      role: role ? role : undefined,
      pagePattern: pagePattern ? pagePattern : undefined,
      token: token ? token : undefined,
      useBuiltinAuth: this.useBuiltinAuth,
      controlPlaneUrl: this.controlPlaneUrl || undefined,
    };

    // Use global getClerkToken if available (preferred method for dynamic token refresh)
    // This is set by the widget loader script
    // Skip when using built-in auth (auth context will provide tokens)
    if (!this.useBuiltinAuth && typeof (window as any).getClerkToken === 'function') {
      config.getToken = (window as any).getClerkToken;
      console.log('[Maven Widget] Using dynamic token refresh via window.getClerkToken');
    } else if (!this.useBuiltinAuth && token) {
      console.log('[Maven Widget] Using static token (no dynamic refresh)');
    } else if (this.useBuiltinAuth) {
      console.log('[Maven Widget] Using built-in authentication');
    }

    // Parse skills from JSON if provided
    const skillsAttr = this.getAttribute('skills');
    if (skillsAttr) {
      try {
        config.skills = JSON.parse(skillsAttr);
      } catch (e) {
        console.error('Failed to parse skills JSON:', e);
      }
    }

    // Parse theme from JSON if provided
    const themeAttr = this.getAttribute('theme');
    if (themeAttr) {
      try {
        config.theme = JSON.parse(themeAttr);
      } catch (e) {
        console.error('Failed to parse theme JSON:', e);
      }
    }

    return config;
  }

  private async fetchDynamicConfig() {
    // Only fetch if we have a tenant slug and API URL
    if (!this.config.tenantSlug || !this.config.apiUrl) {
      console.log('[Maven Widget] Skipping dynamic config fetch (no tenant slug or API URL)');
      return;
    }

    try {
      const configUrl = `${this.config.apiUrl}/api/widget/${this.config.tenantSlug}/config`;
      console.log('[Maven Widget] Fetching dynamic config from:', configUrl);

      const response = await fetch(configUrl, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('[Maven Widget] Failed to fetch config:', response.status);
        return;
      }

      const dynamicConfig = await response.json();
      console.log('[Maven Widget] Received dynamic config:', dynamicConfig);

      // Merge dynamic config with existing config
      // HTML attributes take precedence over API config, but only if they're defined
      // Filter out undefined values from HTML config to prevent overwriting API values
      const definedHtmlConfig = Object.fromEntries(
        Object.entries(this.config).filter(([_, v]) => v !== undefined)
      );

      this.config = {
        ...dynamicConfig,
        ...definedHtmlConfig, // Only defined HTML attributes override API config
        // Special handling for skills - use API skills if not provided via HTML
        skills: this.config.skills || dynamicConfig.skills || [],
        // Special handling for theme - merge theme objects
        theme: {
          ...dynamicConfig.theme,
          ...(this.config.theme || {}),
        },
      };

      console.log('[Maven Widget] Merged config:', this.config);
    } catch (error) {
      console.error('[Maven Widget] Error fetching dynamic config:', error);
      // Continue with HTML-only config on error
    }
  }

  private render() {
    // Create container
    this.container = document.createElement('div');
    this.container.setAttribute('part', 'container');
    this.container.className = 'maven-widget-root';

    // Apply initial theme
    this.applyTheme();

    // Set up media query listener for system theme changes
    if (this.config.themeMode === 'auto' || !this.config.themeMode) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.mediaQueryListener = () => {
        this.applyTheme();
      };
      mediaQuery.addEventListener('change', this.mediaQueryListener);

      // Watch for host page theme class changes (next-themes, etc.)
      this.htmlClassObserver = new MutationObserver(() => {
        this.applyTheme();
      });
      this.htmlClassObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = __WIDGET_CSS__;

    // Apply theme overrides
    if (this.config.theme) {
      const themeVars = [];
      if (this.config.theme.primaryColor) {
        themeVars.push(`--maven-primary: ${this.config.theme.primaryColor}`);
        // Only apply primary color to user message bubbles
        themeVars.push(`--maven-user-bg: ${this.config.theme.primaryColor}`);
      }
      if (this.config.theme.backgroundColor) {
        themeVars.push(`--maven-bg: ${this.config.theme.backgroundColor}`);
      }
      if (this.config.theme.textColor) {
        themeVars.push(`--maven-text: ${this.config.theme.textColor}`);
      }

      if (themeVars.length > 0) {
        style.textContent += `\n:host { ${themeVars.join('; ')}; }`;
      }
    }

    // Append to shadow DOM
    this.shadow.appendChild(style);
    this.shadow.appendChild(this.container);

    // Create React root and render
    this.root = createRoot(this.container);

    // Render widget - wrap with AuthProvider when built-in auth is enabled
    const widgetElement = (
      <ChatWidget
        config={this.config}
        onSidebarWidthChange={(width) => {
          this.updateSidebarWidth(width);
        }}
        onWidgetOpenChange={(isOpen) => {
          this.setWidgetOpen(isOpen);
        }}
        useBuiltinAuth={this.useBuiltinAuth}
      />
    );

    if (this.useBuiltinAuth && this.controlPlaneUrl && this.config.tenantId) {
      this.root.render(
        <AuthProvider
          controlPlaneUrl={this.controlPlaneUrl}
          tenantId={this.config.tenantId}
        >
          {widgetElement}
        </AuthProvider>
      );
    } else {
      this.root.render(widgetElement);
    }
  }

  // Allow updating config dynamically
  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      this.config = this.parseConfig();

      // Reapply theme when theme-mode changes
      if (name === 'theme-mode') {
        this.applyTheme();
      }

      if (this.root) {
        const widgetElement = (
          <ChatWidget
            config={this.config}
            onSidebarWidthChange={(width) => {
              this.updateSidebarWidth(width);
            }}
            onWidgetOpenChange={(isOpen) => {
              this.setWidgetOpen(isOpen);
            }}
            useBuiltinAuth={this.useBuiltinAuth}
          />
        );

        if (this.useBuiltinAuth && this.controlPlaneUrl && this.config.tenantId) {
          this.root.render(
            <AuthProvider
              controlPlaneUrl={this.controlPlaneUrl}
              tenantId={this.config.tenantId}
            >
              {widgetElement}
            </AuthProvider>
          );
        } else {
          this.root.render(widgetElement);
        }
      }
    }
  }

  static get observedAttributes() {
    return [
      'tenant-slug',
      'tenant-id',
      'api-url',
      'agent-url',
      'greeting',
      'placeholder',
      'title',
      'subtitle',
      'avatar',
      'skills',
      'theme',
      'theme-mode',
      'user-id',
      'role',
      'page-pattern',
      'token',
      'use-builtin-auth',
      'control-plane-url',
    ];
  }
}

// Register custom element
if (!customElements.get('maven-widget')) {
  customElements.define('maven-widget', MavenWidget);
}

// Export for programmatic usage
export { MavenWidget };
export type { MavenWidgetConfig };
