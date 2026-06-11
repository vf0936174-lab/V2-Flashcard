// src/index.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App';
import './styles/main.css';
import './i18n'; // initialize i18n

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element not found. Make sure public/index.html has <div id="root"></div>');
}

createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
