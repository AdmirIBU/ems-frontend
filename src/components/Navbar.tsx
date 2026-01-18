import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const [coursesOpen, setCoursesOpen] = useState(false)
  const coursesRef = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const [activeExamId, setActiveExamId] = useState<string | null>(null)
  const [user, setUser] = useState<any>(() => {
    const userJson = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    return userJson ? JSON.parse(userJson) : null
  })

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  useEffect(() => {
    // Refresh from localStorage on navigation so navbar updates after login/profile changes.
    const userJson = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    setUser(userJson ? JSON.parse(userJson) : null)
  }, [location.pathname])

  useEffect(() => {
    const readActive = () => {
      try {
        const id = typeof window !== 'undefined' ? sessionStorage.getItem('ems.activeExamId') : null
        setActiveExamId(id)
      } catch {
        setActiveExamId(null)
      }
    }

    readActive()
    const intervalId = window.setInterval(readActive, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const isStudent = user?.role === 'student'
  const isAdmin = user?.role === 'admin'
  const isExamLocked = isStudent && !!activeExamId

  useEffect(() => {
    // Close dropdown on navigation.
    setCoursesOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (isExamLocked) setCoursesOpen(false)
  }, [isExamLocked])

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = coursesRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setCoursesOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const handleProfile = () => navigate('/profile')
  const handleLogout = () => {
    try {
      const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      const u = rawUser ? JSON.parse(rawUser) : null
      const lockedExamId = typeof window !== 'undefined' ? sessionStorage.getItem('ems.activeExamId') : null
      if (u?.role === 'student' && lockedExamId) return
    } catch {
      // ignore
    }
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-xl font-semibold">
              EMS
            </Link>

            {isExamLocked ? (
              <Link
                to={`/exams/${activeExamId}/take`}
                className="text-sm px-3 py-2 rounded hover:bg-gray-100"
              >
                Resume Exam
              </Link>
            ) : (
              <>
                <div className="relative" ref={coursesRef}>
                  <button
                    className="text-sm px-3 py-2 rounded hover:bg-gray-100"
                    onClick={() => setCoursesOpen((s) => !s)}
                    aria-haspopup="menu"
                    aria-expanded={coursesOpen}
                  >
                    Courses
                  </button>
                  {coursesOpen && (
                    <div
                      className="absolute left-0 mt-2 w-48 bg-white border shadow rounded z-50"
                      role="menu"
                    >
                      <Link
                        to="/courses"
                        className="block px-4 py-2 hover:bg-gray-50"
                        role="menuitem"
                        onClick={() => setCoursesOpen(false)}
                      >
                        All Courses
                      </Link>
                      {!isAdmin && (
                        <Link
                          to="/courses/my"
                          className="block px-4 py-2 hover:bg-gray-50"
                          role="menuitem"
                          onClick={() => setCoursesOpen(false)}
                        >
                          My Courses
                        </Link>
                      )}
                    </div>
                  )}
                </div>

                <Link to="/exams" className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                  Exams
                </Link>

                {(user?.role === 'admin' || user?.role === 'professor') && (
                  <Link to="/exams/past" className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                    Past Exams
                  </Link>
                )}

                {user?.role === 'student' && (
                  <Link to="/grades" className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                    Grades
                  </Link>
                )}

                {(user?.role === 'admin' || user?.role === 'professor') && (
                  <Link
                    to="/students/review"
                    className="text-sm px-3 py-2 rounded hover:bg-gray-100"
                  >
                    Students
                  </Link>
                )}

                {user?.role === 'admin' && (
                  <Link to="/admin/users" className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                    Admin
                  </Link>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <>
                {!isExamLocked && (
                  <>
                    <button className="relative p-2 hover:bg-gray-100 rounded">
                      <span className="sr-only">Notifications</span>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    <button onClick={handleProfile} className="flex items-center gap-2 hover:bg-gray-100 p-2 rounded">
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                        {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className="hidden md:block text-sm">{user?.name || 'Profile'}</div>
                    </button>
                  </>
                )}

                {!isExamLocked && (
                  <button onClick={handleLogout} className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                    Logout
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm px-3 py-2 rounded hover:bg-gray-100">
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
