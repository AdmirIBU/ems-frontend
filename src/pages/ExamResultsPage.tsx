import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type ResultRow = {
  attemptId: string
  student: { _id: string; name: string; email: string }
  pointsAwarded: number
  pointsTotal: number
  needsReview: boolean
  reviewRequested?: boolean
  reviewAppointmentAt?: string
}

type Payload = {
  exam: { _id: string; title: string; date: string }
  results: ResultRow[]
}

export function ExamResultsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!id || !token) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/exams/${id}/results`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load results')
        const payload = (await res.json()) as Payload
        setData(payload)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load results')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [API_BASE, id, token])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Exam Results</h1>
          <Button variant="outline" onClick={() => navigate('/exams')}>Back</Button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !data ? null : (
          <Card>
            <CardHeader>
              <CardTitle>{data.exam.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2">Student</th>
                      <th className="py-2">Points</th>
                      <th className="py-2">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => (
                      <tr key={r.attemptId} className="border-b">
                        <td className="py-2">{r.student?.name}</td>
                        <td className="py-2">
                          {r.pointsAwarded}/{r.pointsTotal}{r.needsReview ? ' (pending)' : ''}
                        </td>
                        <td className="py-2">
                          {r.reviewAppointmentAt ? (
                            <span className="mr-2 text-xs text-gray-600">
                              Scheduled ({new Date(r.reviewAppointmentAt).toLocaleString()})
                            </span>
                          ) : r.reviewRequested ? (
                            <span className="mr-2 text-xs text-gray-600">Requested</span>
                          ) : null}
                          <Button variant="outline" onClick={() => navigate(`/attempts/${r.attemptId}/review`)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {data.results.length === 0 && (
                      <tr>
                        <td className="py-3 text-gray-600" colSpan={3}>No submissions yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
