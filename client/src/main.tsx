import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import './index.css'
import { ThemeProvider } from '@/components/theme-provider'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="vite-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
