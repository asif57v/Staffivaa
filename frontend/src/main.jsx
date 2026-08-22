import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HelmetProvider } from 'react-helmet-async'
import { store } from './store/index.js'
import './index.css'
import App from './App.jsx'

// Global DOM Safety Guard for Browser Auto-Translation & Framer-Motion Unmounting
if (typeof window !== 'undefined') {
  const originalRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child.parentNode !== this) {
      if (console && console.warn) console.warn('Safely handled removeChild on detached node:', child)
      return child
    }
    return originalRemoveChild.apply(this, arguments)
  }

  const originalInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) console.warn('Safely handled insertBefore on detached reference node:', referenceNode)
      return newNode
    }
    return originalInsertBefore.apply(this, arguments)
  }
}

// Auto-reload app when a new deployment invalidates old JS asset chunks
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preload-error', (event) => {
    console.warn('New deployment detected! Reloading page to fetch updated assets...', event)
    const key = 'vite_preload_reload_ts'
    const now = Date.now()
    const last = Number(sessionStorage.getItem(key) || 0)
    if (now - last > 10000) {
      sessionStorage.setItem(key, String(now))
      window.location.reload()
    }
  })
}

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Global React Crash:", error, errorInfo);

    const msg = error?.toString() || ''
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('error loading dynamically imported module')
    ) {
      const key = 'chunk_reload_ts'
      const now = Date.now()
      const last = Number(sessionStorage.getItem(key) || 0)
      if (now - last > 10000) {
        sessionStorage.setItem(key, String(now))
        window.location.reload()
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunkError = (this.state.error?.toString() || '').includes('dynamically imported module')
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', background: '#F8FAFC', color: '#0F172A', minHeight: '100vh' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', background: '#ffffff', padding: '32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h1 style={{ color: '#EF4444', fontSize: '24px', margin: '0 0 16px 0', fontWeight: 'bold' }}>
              {isChunkError ? '🔄 New Version Deployed' : '⚠️ Application Runtime Error'}
            </h1>
            <p style={{ fontSize: '16px', marginBottom: '24px', color: '#475569' }}>
              {isChunkError
                ? 'A new version of Staffivaa was deployed on the server. Please reload the page to load the latest update.'
                : 'An unexpected error occurred while rendering the application. See exact details below:'}
            </p>
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '16px', borderRadius: '8px', overflow: 'auto', marginBottom: '24px' }}>
              <strong style={{ color: '#991B1B', fontSize: '15px' }}>{this.state.error?.toString()}</strong>
              {this.state.errorInfo && (
                <pre style={{ margin: '12px 0 0 0', fontSize: '13px', color: '#7F1D1D', whiteSpace: 'pre-wrap' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>
            <button 
              onClick={() => { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }} 
              style={{ padding: '12px 24px', background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Clear Cache & Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <HelmetProvider>
        <GlobalErrorBoundary>
          <App />
        </GlobalErrorBoundary>
      </HelmetProvider>
    </Provider>
  </StrictMode>,
)

// Register Firebase service worker for mobile background notification support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg => console.log('Firebase Service Worker registered successfully:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
