import React, { StrictMode, Component, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Polyfill AbortSignal.timeout safely for mobile Safari < 16, Android WebViews, WeChat browser
try {
  if (typeof AbortSignal !== 'undefined' && !('timeout' in AbortSignal)) {
    Object.defineProperty(AbortSignal, 'timeout', {
      value: function(ms: number) {
        const controller = new AbortController();
        setTimeout(() => {
          try {
            controller.abort(new DOMException('The operation timed out.', 'TimeoutError'));
          } catch {
            controller.abort();
          }
        }, ms);
        return controller.signal;
      },
      configurable: true,
      writable: true
    });
  }
} catch {
  // Ignore non-configurable globals
}

// Global safe storage helper to prevent QuotaExceededError / SecurityError crashes on iOS Safari Private mode
try {
  const testKey = '__zt_test_storage__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch {
  console.warn('LocalStorage is restricted. Enabling in-memory storage fallback.');
  const memoryStore: Record<string, string> = {};
  const mockStorage = {
    getItem: (k: string) => (k in memoryStore ? memoryStore[k] : null),
    setItem: (k: string, v: string) => { memoryStore[k] = String(v); },
    removeItem: (k: string) => { delete memoryStore[k]; },
    clear: () => { for (const k in memoryStore) delete memoryStore[k]; },
    key: (i: number) => Object.keys(memoryStore)[i] || null,
    get length() { return Object.keys(memoryStore).length; }
  };
  try {
    Object.defineProperty(window, 'localStorage', { value: mockStorage, configurable: true });
  } catch {}
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class GlobalErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Global React Error Boundary caught:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#0A0B0D',
          color: '#e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '420px',
            width: '100%',
            backgroundColor: '#0f172a',
            border: '1px solid #1e293b',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>📈</div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#ffffff', marginBottom: '8px' }}>
              ZeroTrack 投资管理
            </h2>
            <p style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px', lineHeight: 1.6 }}>
              页面在手机加载时遇到网络或缓存波动，请点击下方按钮重新加载。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={this.handleReload}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: '#3b82f6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '15px'
                }}
              >
                🔄 立即刷新重新加载
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🧹 清理缓存并重试
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  </StrictMode>,
);
