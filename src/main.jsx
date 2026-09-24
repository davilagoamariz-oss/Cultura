import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import ErroBoundary from './ErroBoundary.jsx';
import './estilos/base.css';

registerSW({ immediate: true });

createRoot(document.getElementById('raiz')).render(
  <StrictMode>
    <ErroBoundary>
      <App />
    </ErroBoundary>
  </StrictMode>,
);
