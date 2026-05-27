import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RoutePage from './pages/RoutePage'

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  return (
    <BrowserRouter>
      <button className="theme-toggle" onClick={() => setDark(d => !d)} title="Toggle theme">
        {dark ? '☀️' : '🌙'}
      </button>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/route/:id" element={<RoutePage />} />
      </Routes>
    </BrowserRouter>
  )
}
