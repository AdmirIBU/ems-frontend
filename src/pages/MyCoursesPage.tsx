import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

type Course = {
  _id: string
  title: string
  description?: string
}

export function MyCoursesPage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const navigate = useNavigate()
  const [enrolled, setEnrolled] = useState<Course[]>([])
  const [pending, setPending] = useState<Course[]>([])
  const [teaching, setTeaching] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const user = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const role = (user?.role as string | undefined) ?? 'student'

  const fetchMy = async () => {
    if (!token) return
    setLoading(true)
    try {
      if (role === 'admin') {
        navigate('/courses')
        return
      }

      if (role === 'professor') {
        const res = await fetch(`${API_BASE}/api/courses/my-teaching`, { headers: { Authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error('Failed to load teaching courses')
        const data = await res.json()
        setTeaching(Array.isArray(data) ? data : [])
        setEnrolled([])
        setPending([])
        return
      }

      const res = await fetch(`${API_BASE}/api/courses/my-status`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error('Failed to load courses')
      const data = await res.json()
      setEnrolled(Array.isArray(data?.enrolled) ? data.enrolled : [])
      setPending(Array.isArray(data?.pending) ? data.pending : [])
      setTeaching([])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMy()
  }, [])

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">My Courses</h1>
          <div className="bg-white border rounded p-4">Please log in to view your courses.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">My Courses</h1>
        <div className="grid gap-4">
          {loading ? (
            <div>Loading...</div>
          ) : (
            <>
              {role === 'professor' ? (
                <div className="bg-white border rounded p-4">
                  <h2 className="font-semibold mb-2">Teaching / Shared With Me</h2>
                  {teaching.length === 0 ? (
                    <p className="text-sm text-gray-600">No courses assigned to you yet.</p>
                  ) : (
                    <div className="grid gap-2">
                      {teaching.map((c) => (
                        <button
                          key={c._id}
                          className="border rounded p-3 bg-gray-50 text-left hover:bg-gray-100"
                          onClick={() => navigate(`/courses/${c._id}`)}
                        >
                          <div className="font-medium">{c.title}</div>
                          {c.description && <div className="text-sm text-gray-600">{c.description}</div>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="bg-white border rounded p-4">
                    <h2 className="font-semibold mb-2">Enrolled</h2>
                    {enrolled.length === 0 ? (
                      <p className="text-sm text-gray-600">You are not enrolled in any courses.</p>
                    ) : (
                      <div className="grid gap-2">
                        {enrolled.map((c) => (
                          <div
                            key={c._id}
                            className="border rounded p-3 bg-gray-50 hover:bg-gray-100"
                            role="button"
                            tabIndex={0}
                            onClick={() => navigate(`/courses/${c._id}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') navigate(`/courses/${c._id}`)
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="font-medium">{c.title}</div>
                                {c.description && <div className="text-sm text-gray-600">{c.description}</div>}
                              </div>
                              <button
                                className="text-sm text-blue-600 hover:underline whitespace-nowrap"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/courses/${c._id}#materials`)
                                }}
                              >
                                Materials
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white border rounded p-4">
                    <h2 className="font-semibold mb-2">Pending enrollment requests</h2>
                    {pending.length === 0 ? (
                      <p className="text-sm text-gray-600">No pending requests.</p>
                    ) : (
                      <div className="grid gap-2">
                        {pending.map((c) => (
                          <div key={c._id} className="border rounded p-3 bg-gray-50">
                            <div className="font-medium">{c.title}</div>
                            {c.description && <div className="text-sm text-gray-600">{c.description}</div>}
                            <div className="text-xs text-gray-500 mt-1">Status: Pending approval</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
