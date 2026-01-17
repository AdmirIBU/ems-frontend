import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function PastExamsPage() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
  const user = userRaw ? JSON.parse(userRaw) : null
  const isProfessorOrAdmin = user?.role === 'professor' || user?.role === 'admin'

  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/exams`)
        if (!res.ok) throw new Error('Failed to load exams')
        const data = await res.json()
        setExams(Array.isArray(data) ? data : [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load exams')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [API_BASE])

  const now = Date.now()
  const past = exams.filter((exam) => {
    const start = new Date(exam.date).getTime()
    const duration = Number.isFinite(Number(exam.durationMinutes)) ? Number(exam.durationMinutes) : 60
    const end = start + duration * 60_000
    return Number.isFinite(end) && end < now
  })

  if (!isProfessorOrAdmin) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Past Exams</CardTitle>
              <CardDescription>This page is available for professors/admins.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={() => navigate('/exams')}>Back</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Past Exams & Results</h1>
          <Button variant="outline" onClick={() => navigate('/exams')}>Back to Active</Button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : past.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-gray-600">No past exams.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {past.map((exam) => (
              <Card key={exam._id}>
                <CardHeader>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>
                    {exam.course?.title ? (
                      <span>{exam.course.title}{exam.course.courseCode ? ` (${exam.course.courseCode})` : ''}</span>
                    ) : (
                      <span>No course</span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div><strong>Date:</strong> {new Date(exam.date).toLocaleString()}</div>
                  <div><strong>Duration:</strong> {exam.durationMinutes ?? 60} minutes</div>
                  <div><strong>Published:</strong> {exam.published ? 'Yes' : 'No'}</div>
                  {token && (
                    <Button variant="outline" onClick={() => navigate(`/exams/${exam._id}/results`)}>
                      Results
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
