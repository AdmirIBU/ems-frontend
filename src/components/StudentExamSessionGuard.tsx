import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type ActiveAttemptResponse =
  | {
      active: true
      examId: string
      attemptId: string
      expiresAt: string | Date
    }
  | {
      active: false
      expired?: boolean
      examId?: string
      attemptId?: string
    }

function isStudentUser(): boolean {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return false
    const u = JSON.parse(raw)
    return u?.role === 'student'
  } catch {
    return false
  }
}

function isTakeExamPath(pathname: string): boolean {
  // Matches /exams/:id/take
  return /^\/exams\/[^/]+\/take$/.test(pathname)
}

export default function StudentExamSessionGuard() {
  const navigate = useNavigate()
  const location = useLocation()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const isStudent = useMemo(() => (token ? isStudentUser() : false), [token])

  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  const inflightRef = useRef(false)

  const publishLockState = (examId: string | null) => {
    try {
      if (examId) sessionStorage.setItem('ems.activeExamId', examId)
      else sessionStorage.removeItem('ems.activeExamId')
    } catch {
      // ignore
    }
  }

  const check = async () => {
    if (!token || !isStudent) return
    if (inflightRef.current) return
    inflightRef.current = true

    try {
      const res = await fetch(`${API_BASE}/api/exams/active-attempt`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        setActiveExamId(null)
        publishLockState(null)
        return
      }

      const payload = (await res.json()) as ActiveAttemptResponse
      if (!payload || payload.active !== true) {
        setActiveExamId(null)
        publishLockState(null)
        return
      }

      setActiveExamId(payload.examId)
      publishLockState(payload.examId)

      const pathname = location.pathname
      const allowed = isTakeExamPath(pathname)
      if (!allowed) {
        navigate(`/exams/${payload.examId}/take`, { replace: true })
      }
    } catch {
      // If the check fails, don't hard-lock the user out.
      setActiveExamId(null)
      publishLockState(null)
    } finally {
      inflightRef.current = false
    }
  }

  // Check on route changes so clicking around is blocked immediately.
  useEffect(() => {
    void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, token])

  // Poll to handle expiry/unlock even if the user stays on one page.
  useEffect(() => {
    if (!token || !isStudent) return
    const t = window.setInterval(() => void check(), 15_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isStudent])

  // Also block the user from going "Back" into other pages while active.
  useEffect(() => {
    if (!activeExamId) return
    if (isTakeExamPath(location.pathname)) return
    navigate(`/exams/${activeExamId}/take`, { replace: true })
  }, [activeExamId, location.pathname, navigate])

  return null
}
