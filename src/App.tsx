import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { ExamsPage } from './pages/ExamsPage'
import { HomePage } from './pages/HomePage'
import { ProfilePage } from './pages/ProfilePage'
import { CoursesAllPage } from './pages/CoursesAllPage'
import { MyCoursesPage } from './pages/MyCoursesPage'
import { CoursePage } from './pages/CoursePage'
import { AdminUsersPage } from './pages/AdminUsersPage'
import { TakeExamPage } from './pages/TakeExamPage'
import { GradesPage } from './pages/GradesPage'
import { StudentAttemptReviewPage } from './pages/StudentAttemptReviewPage'
import { ExamResultsPage } from './pages/ExamResultsPage'
import { AttemptReviewPage } from './pages/AttemptReviewPage'
import { StudentReviewPage } from './pages/StudentReviewPage'
import { PastExamsPage } from './pages/PastExamsPage'
import { ExamQuestionsConfigPage } from './pages/ExamQuestionsConfigPage'
import StudentExamSessionGuard from './components/StudentExamSessionGuard'
import { DashboardShell } from './components/DashboardShell'
import './App.css'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

function App() {
  return (
    <Router>
      <StudentExamSessionGuard />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/profile" element={<PrivateRoute><DashboardShell><ProfilePage /></DashboardShell></PrivateRoute>} />
        <Route path="/admin/users" element={<PrivateRoute><DashboardShell><AdminUsersPage /></DashboardShell></PrivateRoute>} />
        <Route path="/courses" element={<DashboardShell><CoursesAllPage /></DashboardShell>} />
        <Route path="/courses/my" element={<DashboardShell><MyCoursesPage /></DashboardShell>} />
        <Route path="/courses/:id" element={<PrivateRoute><DashboardShell><CoursePage /></DashboardShell></PrivateRoute>} />
        <Route path="/exams" element={<PrivateRoute><DashboardShell><ExamsPage /></DashboardShell></PrivateRoute>} />
        <Route path="/exams/questions" element={<PrivateRoute><DashboardShell><ExamQuestionsConfigPage /></DashboardShell></PrivateRoute>} />
        <Route path="/exams/past" element={<PrivateRoute><DashboardShell><PastExamsPage /></DashboardShell></PrivateRoute>} />
        <Route path="/exams/:id/take" element={<PrivateRoute><DashboardShell><TakeExamPage /></DashboardShell></PrivateRoute>} />
        <Route path="/grades" element={<PrivateRoute><DashboardShell><GradesPage /></DashboardShell></PrivateRoute>} />
        <Route path="/grades/:attemptId" element={<PrivateRoute><DashboardShell><StudentAttemptReviewPage /></DashboardShell></PrivateRoute>} />
        <Route path="/exams/:id/results" element={<PrivateRoute><DashboardShell><ExamResultsPage /></DashboardShell></PrivateRoute>} />
        <Route path="/attempts/:attemptId/review" element={<PrivateRoute><DashboardShell><AttemptReviewPage /></DashboardShell></PrivateRoute>} />
        <Route path="/students/review" element={<PrivateRoute><DashboardShell><StudentReviewPage /></DashboardShell></PrivateRoute>} />
        <Route path="/" element={<DashboardShell><HomePage /></DashboardShell>} />
      </Routes>
    </Router>
  )
}

export default App
