import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Question = {
  _id: string
  type: 'essay' | 'multiple-choice' | 'tf' | 'image-upload'
  content: string
  points?: number
}

type LocationState = {
  courseId?: string
  mode?: 'manual' | 'random'
  selectedQuestionIds?: string[]
  randomConfig?: {
    totalQuestions?: number
    mcCount?: number
    tfCount?: number
    imageCount?: number
    essayCount?: number
    shuffleOrder?: boolean
  }
}

export function ExamQuestionsConfigPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const state = (location.state ?? {}) as LocationState
  const courseId = typeof state.courseId === 'string' ? state.courseId : ''

  const API_BASE = import.meta.env.VITE_API_URL ?? ''

  const [mode, setMode] = useState<'manual' | 'random'>(state.mode ?? 'manual')
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [error, setError] = useState<string>('')

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(state.selectedQuestionIds ?? [])

  const [totalQuestions, setTotalQuestions] = useState<number>(state.randomConfig?.totalQuestions ?? 10)
  const [mcCount, setMcCount] = useState<number>(state.randomConfig?.mcCount ?? 0)
  const [tfCount, setTfCount] = useState<number>(state.randomConfig?.tfCount ?? 0)
  const [imageCount, setImageCount] = useState<number>(state.randomConfig?.imageCount ?? 0)
  const [essayCount, setEssayCount] = useState<number>(state.randomConfig?.essayCount ?? 0)
  const [shuffleOrder, setShuffleOrder] = useState<boolean>(state.randomConfig?.shuffleOrder ?? true)

  useEffect(() => {
    if (!courseId) {
      navigate('/exams', { replace: true })
      return
    }

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/courses/${courseId}/questions`)
        if (!res.ok) throw new Error('Failed to load questions')
        const data = await res.json()
        setQuestions(Array.isArray(data) ? data : [])
      } catch (e) {
        setQuestions([])
        setError(e instanceof Error ? e.message : 'Failed to load questions')
      } finally {
        setLoading(false)
      }
    })()
  }, [API_BASE, courseId, navigate])

  useEffect(() => {
    if (mode === 'manual') {
      setTotalQuestions(selectedQuestionIds.length > 0 ? selectedQuestionIds.length : totalQuestions)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const remaining = useMemo(() => {
    const sum = (Number(mcCount) || 0) + (Number(tfCount) || 0) + (Number(imageCount) || 0) + (Number(essayCount) || 0)
    return (Number(totalQuestions) || 0) - sum
  }, [essayCount, imageCount, mcCount, tfCount, totalQuestions])

  const labelFor = (t: Question['type']) => {
    if (t === 'multiple-choice') return 'MC'
    if (t === 'tf') return 'T/F'
    if (t === 'image-upload') return 'IMG'
    return 'Essay'
  }

  const save = () => {
    setError('')

    const storageKey = `ems.examQuestionConfig:${courseId}`

    if (mode === 'manual') {
      if (selectedQuestionIds.length === 0) {
        setError('Select at least one question or switch to random selection')
        return
      }

      const cfg = {
        courseId,
        mode: 'manual' as const,
        selectedQuestionIds,
        totalQuestions: selectedQuestionIds.length,
      }

      try {
        sessionStorage.setItem(storageKey, JSON.stringify(cfg))
      } catch {
        // ignore storage errors
      }

      navigate('/exams', {
        state: {
          examQuestionConfig: cfg,
        },
      })
      return
    }

    const total = Number(totalQuestions)
    const mc = Number(mcCount)
    const tf = Number(tfCount)
    const img = Number(imageCount)
    const essay = Number(essayCount)

    if (!Number.isFinite(total) || total < 1) return setError('Total questions must be at least 1')
    if ([mc, tf, img, essay].some((x) => !Number.isFinite(x) || x < 0)) return setError('Counts must be 0 or greater')
    if (mc + tf + img + essay > total) return setError('MC + TF + Image + Essay counts cannot exceed Total questions')

    const cfg = {
      courseId,
      mode: 'random' as const,
      totalQuestions: total,
      randomConfig: {
        mcCount: mc,
        tfCount: tf,
        imageCount: img,
        essayCount: essay,
        shuffleOrder,
      },
    }

    try {
      sessionStorage.setItem(storageKey, JSON.stringify(cfg))
    } catch {
      // ignore storage errors
    }

    navigate('/exams', {
      state: {
        examQuestionConfig: cfg,
      },
    })
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Configure Exam Questions</h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/exams')}>Back</Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>

        {error && <div className="text-red-600">{error}</div>}

        <Card>
          <CardHeader>
            <CardTitle>Selection Mode</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant={mode === 'manual' ? 'default' : 'outline'} onClick={() => setMode('manual')}>
              Manual selection
            </Button>
            <Button variant={mode === 'random' ? 'default' : 'outline'} onClick={() => setMode('random')}>
              Random selection
            </Button>
          </CardContent>
        </Card>

        {mode === 'random' ? (
          <Card>
            <CardHeader>
              <CardTitle>Random Selection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-end">
                <label className="text-sm">
                  <div className="mb-1">Total questions</div>
                  <input
                    type="number"
                    min={1}
                    className="border rounded p-2 w-full"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(Number(e.target.value))}
                  />
                </label>
                <label className="text-sm">
                  <div className="mb-1">MC</div>
                  <input type="number" min={0} className="border rounded p-2 w-full" value={mcCount} onChange={(e) => setMcCount(Number(e.target.value))} />
                </label>
                <label className="text-sm">
                  <div className="mb-1">T/F</div>
                  <input type="number" min={0} className="border rounded p-2 w-full" value={tfCount} onChange={(e) => setTfCount(Number(e.target.value))} />
                </label>
                <label className="text-sm">
                  <div className="mb-1">Image</div>
                  <input type="number" min={0} className="border rounded p-2 w-full" value={imageCount} onChange={(e) => setImageCount(Number(e.target.value))} />
                </label>
                <label className="text-sm">
                  <div className="mb-1">Essay</div>
                  <input type="number" min={0} className="border rounded p-2 w-full" value={essayCount} onChange={(e) => setEssayCount(Number(e.target.value))} />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={shuffleOrder} onChange={(e) => setShuffleOrder(e.target.checked)} />
                Randomize question order for each student
              </label>

              <div className="text-sm text-gray-700">
                Remaining questions: <strong>{remaining}</strong> (filled randomly from the rest of the course pool).
              </div>
              <div className="text-xs text-gray-600">
                Each student gets a randomized question set and order when they start the exam.
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Manual Selection</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm">Loading questions...</div>
              ) : questions.length === 0 ? (
                <div className="text-sm text-gray-600">No questions found for this course.</div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-auto">
                  {questions.map((q) => {
                    const checked = selectedQuestionIds.includes(q._id)
                    return (
                      <label key={q._id} className="flex items-start gap-2 text-sm border rounded p-2 bg-white">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked ? [...selectedQuestionIds, q._id] : selectedQuestionIds.filter((id) => id !== q._id)
                            setSelectedQuestionIds(next)
                          }}
                        />
                        <div>
                          <div className="font-medium">[{labelFor(q.type)}] {q.content}</div>
                          {typeof q.points === 'number' && <div className="text-xs text-gray-600">Points: {q.points}</div>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
