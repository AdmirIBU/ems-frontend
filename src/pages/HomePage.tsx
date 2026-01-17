import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function HomePage() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const user = userRaw ? JSON.parse(userRaw) : null
  const isStudent = user?.role === 'student'
  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin'

  type NotificationItem = {
    id: string
    type: 'upcoming-exam' | 'exam-reviewed'
    title: string
    body: string
    action?: { label: string; to: string }
  }

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)

  const authHeaders: Record<string, string> | undefined = useMemo(() => {
    return token ? { Authorization: `Bearer ${token}` } : undefined
  }, [token])

  const news = [
    { id: 1, title: 'Welcome to EMS', body: 'This is the central dashboard for your exams and courses.' },
    { id: 2, title: 'Maintenance', body: 'Planned maintenance on 2026-01-01 from 03:00 UTC.' },
  ]

  useEffect(() => {
    async function loadStudentNotifications() {
      if (!token || !isStudent) {
        setNotifications([])
        return
      }

      setLoadingNotifs(true)
      try {
        // 1) Determine which courses the student is enrolled in
        const coursesRes = await fetch(`${API_BASE}/api/courses/my-status`, { headers: authHeaders })
        if (!coursesRes.ok) throw new Error('Failed to load courses')
        const coursesData = await coursesRes.json()
        const enrolledCourseIds = new Set(
          (Array.isArray(coursesData?.enrolled) ? coursesData.enrolled : [])
            .map((c: any) => c?._id)
            .filter((id: any) => typeof id === 'string')
        )

        // 2) Upcoming exams (next 7 days) for enrolled courses
        const examsRes = await fetch(`${API_BASE}/api/exams`)
        if (!examsRes.ok) throw new Error('Failed to load exams')
        const examsData = await examsRes.json()
        const now = Date.now()
        const in7Days = now + 7 * 24 * 60 * 60_000

        const upcoming = (Array.isArray(examsData) ? examsData : [])
          .filter((e: any) => e?.published)
          .filter((e: any) => {
            const courseId = e?.course?._id
            return typeof courseId === 'string' && enrolledCourseIds.has(courseId)
          })
          .filter((e: any) => {
            const start = new Date(e?.date).getTime()
            return Number.isFinite(start) && start > now && start <= in7Days
          })
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

        // 3) Reviewed exams (gradedAt present)
        const gradesRes = await fetch(`${API_BASE}/api/grades`, { headers: authHeaders })
        if (!gradesRes.ok) throw new Error('Failed to load grades')
        const gradesData = await gradesRes.json()
        const reviewed = (Array.isArray(gradesData) ? gradesData : [])
          .filter((g: any) => g?.gradedAt)
          .sort((a: any, b: any) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime())

        const items: NotificationItem[] = []

        for (const e of upcoming) {
          const when = new Date(e.date)
          items.push({
            id: `upcoming:${e._id}`,
            type: 'upcoming-exam',
            title: 'Upcoming exam',
            body: `${e.title}${e.course?.title ? ` — ${e.course.title}` : ''} starts ${when.toLocaleString()}.`,
            action: { label: 'View exams', to: '/exams' },
          })
        }

        for (const g of reviewed) {
          const when = new Date(g.gradedAt)
          items.push({
            id: `reviewed:${g.id}`,
            type: 'exam-reviewed',
            title: 'Exam reviewed',
            body: `${g?.exam?.title ?? 'Exam'} was reviewed on ${when.toLocaleString()}.`,
            action: { label: 'View grades', to: '/grades' },
          })
        }

        setNotifications(items)
      } catch (e) {
        // Keep the dashboard usable; show no notifications on failure.
        console.warn(e)
        setNotifications([])
      } finally {
        setLoadingNotifs(false)
      }
    }

    void loadStudentNotifications()
  }, [API_BASE, authHeaders, isStudent, token])

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isProfessorOrAdmin ? (
                    <>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/exams')}>
                        Create Exam
                      </Button>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/courses')}>
                        Manage Courses
                      </Button>
                    </>
                  ) : isStudent ? (
                    <>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/exams')}>
                        View Exams
                      </Button>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/grades')}>
                        My Grades
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/exams')}>
                        View Exams
                      </Button>
                      <Button variant="outline" className="justify-start h-auto p-4" onClick={() => navigate('/courses')}>
                        Browse Courses
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                {!isStudent ? (
                  <p className="text-sm text-gray-600">No new notifications.</p>
                ) : loadingNotifs ? (
                  <p className="text-sm text-gray-600">Loading...</p>
                ) : notifications.length === 0 ? (
                  <p className="text-sm text-gray-600">No new notifications.</p>
                ) : (
                  <div className="space-y-2">
                    {notifications.map((n) => (
                      <div key={n.id} className="border p-3 rounded bg-white">
                        <div className="font-semibold">{n.title}</div>
                        <div className="text-sm text-gray-600">{n.body}</div>
                        {n.action && (
                          <div className="mt-2">
                            <Button variant="outline" onClick={() => navigate(n.action!.to)}>
                              {n.action.label}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>News</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {news.map((n) => (
                    <div key={n.id} className="border p-3 rounded">
                      <h3 className="font-semibold">{n.title}</h3>
                      <p className="text-sm text-gray-600">{n.body}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
