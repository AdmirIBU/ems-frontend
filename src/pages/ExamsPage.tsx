import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ExamsPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const API_BASE = import.meta.env.VITE_API_URL ?? ''

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/exams`)
      if (!res.ok) throw new Error('Failed to fetch exams')
      const data = await res.json()
      setExams(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exams')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  if (loading) return <div className="text-center mt-8">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Exams</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {error && <div className="text-red-600 mb-4">{error}</div>}

        {exams.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600">No exams available yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {exams.map((exam) => (
              <Card key={exam._id}>
                <CardHeader>
                  <CardTitle>{exam.title}</CardTitle>
                  <CardDescription>{exam.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm">
                    <strong>Date:</strong> {new Date(exam.date).toLocaleDateString()}
                  </p>
                  <p className="text-sm">
                    <strong>Duration:</strong> {exam.durationMinutes} minutes
                  </p>
                  <p className="text-sm">
                    <strong>Created by:</strong> {exam.createdBy?.name || 'Unknown'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
