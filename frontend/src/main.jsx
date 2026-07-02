import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { HelmetProvider } from 'react-helmet-async'
import { store } from './store/index.js'
import './index.css'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </Provider>
  </StrictMode>,
)

// Register Firebase service worker for mobile background notification support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.navigator = navigator || {};
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(reg => console.log('Firebase Service Worker registered successfully:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}
