import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IDEPage from './pages/IDEPage'
import KnowledgeHubPage from './pages/KnowledgeHubPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/ide" replace />} />
        <Route path="/ide" element={<IDEPage />} />
        <Route path="/knowledge" element={<KnowledgeHubPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
