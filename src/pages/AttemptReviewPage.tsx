import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ReviewAnswer = {
  question: {
    id: string
    type?: 'essay' | 'multiple-choice' | 'tf'
    content?: string
    options?: string[]
    correctAnswer?: any
    points?: number
  }
  answer: any
  isCorrect?: boolean
  pointsAwarded: number
  maxPoints: number
}

type Payload = {
  attempt: {
    id: string
    student: { _id: string; name: string; email: string }
    pointsAwarded: number
    pointsTotal: number
    needsReview: boolean
    submittedAt?: string
    reviewRequested?: boolean
    reviewRequestedAt?: string
    reviewRequestMessage?: string
    reviewResponseMessage?: string
    reviewAppointmentAt?: string
  }
  exam: { _id: string; title: string }
  answers: ReviewAnswer[]
}

export function AttemptReviewPage() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [essayPoints, setEssayPoints] = useState<Record<string, number>>({})
  const [responding, setResponding] = useState(false)
  const [responseMessage, setResponseMessage] = useState('')
  const [appointmentLocal, setAppointmentLocal] = useState('')

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token ?? ''}` }), [token])

  const load = async () => {
    if (!attemptId || !token) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/review`, {
        headers: authHeaders,
      })
      if (!res.ok) throw new Error('Failed to load review')
      const payload = (await res.json()) as Payload
      setData(payload)

      setResponseMessage(payload.attempt.reviewResponseMessage ?? '')
      if (payload.attempt.reviewAppointmentAt) {
        const d = new Date(payload.attempt.reviewAppointmentAt)
        if (!Number.isNaN(d.getTime())) {
          // Convert to local datetime-local value (YYYY-MM-DDTHH:mm)
          const pad = (n: number) => String(n).padStart(2, '0')
          const yyyy = d.getFullYear()
          const mm = pad(d.getMonth() + 1)
          const dd = pad(d.getDate())
          const hh = pad(d.getHours())
          const mi = pad(d.getMinutes())
          setAppointmentLocal(`${yyyy}-${mm}-${dd}T${hh}:${mi}`)
        }
      } else {
        setAppointmentLocal('')
      }

      const init: Record<string, number> = {}
      for (const a of payload.answers) {
        if (a.question?.type === 'essay') {
          init[a.question.id] = a.pointsAwarded ?? 0
        }
      }
      setEssayPoints(init)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load review')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  const handleSave = async () => {
    if (!attemptId || !token) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/grade`, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pointsByQuestion: essayPoints }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Failed to save grade')
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save grade')
    } finally {
      setSaving(false)
    }
  }

  const handleSendResponse = async () => {
    if (!attemptId || !token) return
    setResponding(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/exams/attempts/${attemptId}/review-response`, {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentAt: appointmentLocal ? new Date(appointmentLocal).toISOString() : null,
          message: responseMessage.trim() ? responseMessage : null,
        }),
      })
      if (!res.ok) {
        let msg = 'Failed to send response'
        try {
          const j = await res.json()
          msg = String(j?.error ?? j?.message ?? msg)
        } catch {
          // ignore
        }
        throw new Error(msg)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send response')
    } finally {
      setResponding(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Grade Review</h1>
          <Button variant="outline" onClick={() => navigate('/exams')}>Back</Button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !data ? null : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{data.exam.title}</CardTitle>
                <CardDescription>
                  Student: {data.attempt.student.name} — {data.attempt.pointsAwarded}/{data.attempt.pointsTotal}
                  {data.attempt.needsReview ? ' (pending)' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Grade'}
                  </Button>

                  {data.attempt.reviewRequested ? (
                    <span className="text-xs text-muted-foreground">
                      Review requested{data.attempt.reviewRequestedAt ? `: ${new Date(data.attempt.reviewRequestedAt).toLocaleString()}` : ''}
                    </span>
                  ) : null}
                </div>

                {data.attempt.reviewRequested ? (
                  <div className="mt-4 space-y-3">
                    {data.attempt.reviewRequestMessage ? (
                      <div className="text-sm">
                        <div className="font-medium">Student message</div>
                        <div className="text-muted-foreground">{data.attempt.reviewRequestMessage}</div>
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <div className="text-sm font-medium">Set appointment (optional)</div>
                      <Input
                        type="datetime-local"
                        value={appointmentLocal}
                        onChange={(e) => setAppointmentLocal(e.target.value)}
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="text-sm font-medium">Response message (optional)</div>
                      <textarea
                        className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        placeholder="Message to student (optional)"
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                      />
                    </div>

                    <Button onClick={handleSendResponse} disabled={responding}>
                      {responding ? 'Sending...' : 'Send Response'}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-4">
              {data.answers.map((a, idx) => (
                <Card key={a.question.id}>
                  <CardHeader>
                    <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                    <CardDescription>{a.question.type}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>{a.question.content}</div>

                    {(a.question.type === 'multiple-choice' || a.question.type === 'tf') && (
                      <>
                        <div>
                          <strong>Correct:</strong> {String(a.question.correctAnswer)}
                        </div>
                        <div>
                          <strong>Student:</strong> {String(a.answer)}
                        </div>
                        <div>
                          <strong>Result:</strong> {a.isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                        <div>
                          <strong>Points:</strong> {a.pointsAwarded}/{a.maxPoints}
                        </div>
                      </>
                    )}

                    {a.question.type === 'essay' && (
                      <>
                        <div>
                          <strong>Student answer:</strong>
                          <div className="mt-2 whitespace-pre-wrap border rounded p-2 bg-white">{String(a.answer ?? '')}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Points:</span>
                          <Input
                            type="number"
                            min={0}
                            max={a.maxPoints}
                            value={essayPoints[a.question.id] ?? 0}
                            onChange={(e) =>
                              setEssayPoints((prev) => ({ ...prev, [a.question.id]: Number(e.target.value) }))
                            }
                            className="w-28"
                          />
                          <span className="text-gray-600">/ {a.maxPoints}</span>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
