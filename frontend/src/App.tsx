import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import IDEPage from './pages/IDEPage'
import KnowledgeHubPage from './pages/KnowledgeHubPage'
import AdaptiveLearningPage from './pages/AdaptiveLearningPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/ide" replace />} />
        <Route path="/ide" element={<IDEPage />} />
        <Route path="/knowledge" element={<KnowledgeHubPage />} />
        <Route path="/adaptive-learning" element={<AdaptiveLearningPage />} />
        <Route path="/adaptive" element={<Navigate to="/adaptive-learning" replace />} />
        <Route path="/ps1" element={<Navigate to="/adaptive-learning" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
