import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/privacy" element={<App page="privacy" />} />
        <Route path="/terms" element={<App page="terms" />} />
        <Route path="/pricing" element={<App page="pricing" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
