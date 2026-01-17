import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { computeLetterGrade, computeScorePercent, formatScorePercent } from '@/utils/grading'

type GradeRow = {
  id: string
  exam: { title: string; date: string }
  submittedAt: string
  pointsAwarded: number
  pointsTotal: number
  needsReview: boolean
  gradedAt?: string
  reviewRequested?: boolean
  reviewRequestedAt?: string
  reviewResponseMessage?: string
  reviewAppointmentAt?: string
  reviewRespondedAt?: string
  scorePercent?: number
  grade?: string | null
  passed?: boolean | null
}

export function GradesPage() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [grades, setGrades] = useState<GradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/grades`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load grades')
        const data = await res.json()
        setGrades(Array.isArray(data) ? data : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load grades')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [API_BASE, token])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">My Grades</h1>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : grades.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-gray-600">No grades yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {grades.map((g) => (
              <Card key={g.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{g.exam?.title ?? 'Exam'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div>
                    <strong>Date taken:</strong> {g.submittedAt ? new Date(g.submittedAt).toLocaleString() : '—'}
                  </div>
                  <div>
                    <strong>Result:</strong>{' '}
                    {(() => {
                      const fallbackPct = computeScorePercent(g.pointsAwarded, g.pointsTotal)
                      const scorePercent = typeof g.scorePercent === 'number' ? g.scorePercent : fallbackPct
                      const grade = typeof g.grade === 'string' ? g.grade : (g.needsReview ? null : computeLetterGrade(scorePercent))
                      const passed = typeof g.passed === 'boolean' ? g.passed : (g.needsReview ? null : scorePercent >= 55)
                      return `${formatScorePercent(scorePercent)}${grade ? ` (${grade})` : ''}${typeof passed === 'boolean' ? (passed ? ' — Pass' : ' — Fail') : ''}`
                    })()}
                  </div>
                  <div>
                    <strong>Points:</strong> {g.pointsAwarded}/{g.pointsTotal}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    {g.reviewAppointmentAt
                      ? `Appointment scheduled (${new Date(g.reviewAppointmentAt).toLocaleString()})`
                      : g.reviewRequested
                        ? 'Review requested'
                        : (g.needsReview ? 'Pending review' : 'Final')}
                  </div>
                  <Button variant="outline" onClick={() => navigate(`/grades/${g.id}`)}>
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
