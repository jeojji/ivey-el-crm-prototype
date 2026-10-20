import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import { createRepository } from './data';
import { DataProvider } from './state/DataContext';
import { ToastProvider } from './state/ToastContext';
import './index.css';

const repository = createRepository();

// HashRouter keeps URLs like /#/companies working on GitHub Pages without server config.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ToastProvider>
        <DataProvider repository={repository}>
          <App />
        </DataProvider>
      </ToastProvider>
    </HashRouter>
  </StrictMode>,
);
