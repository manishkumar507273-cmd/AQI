import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// ── Production-only code protection ──────────────────────────────────────────
if (import.meta.env.PROD) {
  // Disable right-click context menu
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // Block common DevTools keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // F12
    if (e.key === 'F12') { e.preventDefault(); return false; }
    // Ctrl+Shift+I / Cmd+Option+I (DevTools)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return false; }
    // Ctrl+Shift+J / Cmd+Option+J (Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'J') { e.preventDefault(); return false; }
    // Ctrl+Shift+C (Inspector)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') { e.preventDefault(); return false; }
    // Ctrl+U (View Source)
    if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return false; }
    // Ctrl+S (Save page)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); return false; }
  });

  // Override console methods in production to silence any leaks
  const noop = () => {};
  ['log', 'warn', 'error', 'info', 'debug', 'table', 'dir', 'trace'].forEach((m) => {
    try { window.console[m] = noop; } catch (_) {}
  });

  // Detect DevTools open via timing attack (fires when DevTools slows execution)
  let _dtOpen = false;
  const _dtCheck = () => {
    const t = new Date();
    // eslint-disable-next-line no-debugger
    debugger; // Will pause when DevTools is open
    if (new Date() - t > 100 && !_dtOpen) {
      _dtOpen = true;
      document.body.innerHTML = '';
      window.location.reload();
    }
  };
  setInterval(_dtCheck, 3000);
}
// ─────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

