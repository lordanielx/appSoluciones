import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento raíz no encontrado');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
