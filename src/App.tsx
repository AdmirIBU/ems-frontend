import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ExamsPage } from './pages/ExamsPage'
import './App.css'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/exams"
          element={
            <PrivateRoute>
              <ExamsPage />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/exams" replace />} />
      </Routes>
    </Router>
  )
}

export default App
