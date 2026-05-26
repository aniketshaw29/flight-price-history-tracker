import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import RoutePage from './pages/RoutePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/route/:id" element={<RoutePage />} />
      </Routes>
    </BrowserRouter>
  )
}
