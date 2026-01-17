import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type Course = {
  _id: string
  title: string
  description?: string
  courseCode?: string
  syllabus?: { path?: string }
  professors?: Array<{ _id: string; name?: string; email?: string }>
}

type Material = {
  id: string
  title: string
  kind: 'lecture' | 'lab' | 'video' | 'other'
  originalName: string
  mimetype: string
  size: number
  uploadedAt: string
}

type MaterialIconKind = 'video' | 'sheet' | 'doc' | 'file'

function getExt(filename: string): string {
  const base = String(filename ?? '').trim().toLowerCase()
  const idx = base.lastIndexOf('.')
  if (idx < 0) return ''
  return base.slice(idx + 1)
}

function pickMaterialIcon(m: Material): MaterialIconKind {
  const mimetype = String(m.mimetype ?? '').toLowerCase()
  const ext = getExt(m.originalName)

  if (mimetype.startsWith('video/') || m.kind === 'video') return 'video'

  if (
    mimetype === 'text/csv' ||
    mimetype === 'application/vnd.ms-excel' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    ['xls', 'xlsx', 'csv', 'ods'].includes(ext)
  ) {
    return 'sheet'
  }

  if (
    mimetype === 'application/pdf' ||
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)
  ) {
    return 'doc'
  }

  return 'file'
}

function MaterialIcon({ kind }: { kind: MaterialIconKind }) {
  const common = 'h-4 w-4'

  if (kind === 'video') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M3 7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" strokeWidth="1.5" />
        <path d="M10 9.5v5l4-2.5-4-2.5z" fill="currentColor" stroke="none" />
        <path d="M17 10l4-2v8l-4-2v-4z" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    )
  }

  if (kind === 'sheet') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" strokeWidth="1.5" />
        <path d="M14 3v5h5" strokeWidth="1.5" />
        <path d="M8 12h8M8 16h8M10 10v10M14 10v10" strokeWidth="1.25" />
      </svg>
    )
  }

  if (kind === 'doc') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" strokeWidth="1.5" />
        <path d="M14 3v5h5" strokeWidth="1.5" />
        <path d="M8 12h8M8 16h8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" strokeWidth="1.5" />
      <path d="M14 3v5h5" strokeWidth="1.5" />
    </svg>
  )
}

export function CoursePage() {
  const { id } = useParams()
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const user = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  }, [])

  const [course, setCourse] = useState<Course | null>(null)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadKind, setUploadKind] = useState<'lecture' | 'lab' | 'video' | 'other'>('lecture')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [shareEmails, setShareEmails] = useState('')
  const [sharing, setSharing] = useState(false)
  const [shareError, setShareError] = useState('')

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token ?? ''}` }),
    [token]
  )

  const canUpload = user?.role === 'professor' || user?.role === 'admin'
  const canShare = user?.role === 'professor'
  const backTo = user?.role === 'admin' ? '/courses' : '/courses/my'

  const grouped = useMemo(() => {
    const byKind: Record<'lecture' | 'lab' | 'video' | 'other', Material[]> = {
      lecture: [],
      lab: [],
      video: [],
      other: [],
    }
    for (const m of materials) {
      const k = (m.kind ?? 'other') as Material['kind']
      ;(byKind[k] ?? byKind.other).push(m)
    }
    return byKind
  }, [materials])

  const load = async () => {
    if (!id || !token) return
    setLoading(true)
    setError('')
    try {
      const [courseRes, materialsRes] = await Promise.all([
        fetch(`${API_BASE}/api/courses/${id}`, { headers: authHeaders }),
        fetch(`${API_BASE}/api/courses/${id}/materials`, { headers: authHeaders }),
      ])

      if (!courseRes.ok) throw new Error('Failed to load course')
      if (!materialsRes.ok) {
        const txt = await materialsRes.text().catch(() => '')
        throw new Error(txt || 'Failed to load course materials')
      }

      const coursePayload = (await courseRes.json()) as Course
      const materialsPayload = (await materialsRes.json()) as Material[]

      setCourse(coursePayload)
      setMaterials(Array.isArray(materialsPayload) ? materialsPayload : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load course')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const downloadUrl = (materialId: string) => `${API_BASE}/api/courses/${id}/materials/${materialId}/download`

  const upload = async () => {
    if (!id || !token) return
    if (!uploadFile) {
      setUploadError('Please choose a file')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('title', uploadTitle)
      fd.append('kind', uploadKind)
      fd.append('file', uploadFile)

      const res = await fetch(`${API_BASE}/api/courses/${id}/materials`, {
        method: 'POST',
        headers: {
          ...authHeaders,
        },
        body: fd,
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Upload failed')
      }

      setUploadTitle('')
      setUploadKind('lecture')
      setUploadFile(null)
      await load()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const share = async () => {
    if (!id || !token) return
    setSharing(true)
    setShareError('')
    try {
      const emails = shareEmails
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      if (emails.length === 0) {
        setShareError('Enter professor email(s) separated by commas')
        return
      }

      const res = await fetch(`${API_BASE}/api/courses/${id}/professors/share`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(txt || 'Share failed')
      }

      setShareEmails('')
      await load()
    } catch (e) {
      setShareError(e instanceof Error ? e.message : 'Share failed')
    } finally {
      setSharing(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white border rounded p-4">Please log in to view this course.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Course</h1>
          <Link className="text-sm text-blue-600 hover:underline" to={backTo}>
            {user?.role === 'admin' ? 'Back to All Courses' : 'Back to My Courses'}
          </Link>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !course ? null : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{course.title}</CardTitle>
                <CardDescription>
                  {course.courseCode ? `${course.courseCode} — ` : ''}
                  {course.description || '—'}
                </CardDescription>
              </CardHeader>
              {(course as any)?.syllabus?.path && (
                <CardContent className="text-sm">
                  <a
                    className="text-blue-600 hover:underline"
                    href={(course as any).syllabus.path}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download syllabus
                  </a>
                </CardContent>
              )}
            </Card>

            {canShare && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Share With Professors</CardTitle>
                  <CardDescription>Add other professors by email (comma separated).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {shareError && <div className="text-red-600">{shareError}</div>}
                  <Input
                    value={shareEmails}
                    onChange={(e) => setShareEmails(e.target.value)}
                    placeholder="prof1@university.edu, prof2@university.edu"
                  />
                  <Button onClick={() => void share()} disabled={sharing || shareEmails.trim().length === 0}>
                    {sharing ? 'Sharing...' : 'Share'}
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader id="materials">
                <CardTitle className="text-base">Course Materials</CardTitle>
                <CardDescription>Lectures, labs, and video materials for this course.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {materials.length === 0 ? (
                  <div className="text-gray-600">No materials uploaded yet.</div>
                ) : (
                  <div className="space-y-4">
                    {([
                      ['lecture', 'Lectures'],
                      ['lab', 'Labs'],
                      ['video', 'Video Lectures'],
                      ['other', 'Other'],
                    ] as const).map(([kind, label]) => {
                      const items = grouped[kind]
                      if (!items || items.length === 0) return null
                      return (
                        <div key={kind} className="space-y-2">
                          <div className="font-semibold">{label}</div>
                          <div className="space-y-2">
                            {items.map((m) => (
                              <div key={m.id} className="flex items-center justify-between gap-3 border rounded bg-white p-3">
                                <div>
                                  <div className="font-medium">{m.title}</div>
                                  <div className="text-xs text-gray-600">
                                    {new Date(m.uploadedAt).toLocaleString()} • {(m.size / (1024 * 1024)).toFixed(1)} MB
                                  </div>
                                </div>
                                <a
                                  className="text-blue-600 hover:underline"
                                  href={downloadUrl(m.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    <MaterialIcon kind={pickMaterialIcon(m)} />
                                    <span>{m.mimetype.startsWith('video/') || m.kind === 'video' ? 'Open Video' : 'Open'}</span>
                                  </span>
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {canUpload && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Upload Material</CardTitle>
                  <CardDescription>Upload lecture slides, labs, or video lectures.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {uploadError && <div className="text-destructive">{uploadError}</div>}
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Title</Label>
                    <Input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Lecture 1" />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Type</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={uploadKind}
                      onChange={(e) => setUploadKind(e.target.value as any)}
                    >
                      <option value="lecture">Lecture</option>
                      <option value="lab">Lab</option>
                      <option value="video">Video</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="material-file" className="text-xs text-muted-foreground">File</Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
                      <input
                        id="material-file"
                        type="file"
                        className="sr-only"
                        onChange={(e) => setUploadFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                      />
                      <Button asChild variant="outline" size="sm">
                        <label htmlFor="material-file" className="cursor-pointer">Choose</label>
                      </Button>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {uploadFile ? uploadFile.name : 'No file selected'}
                      </span>
                    </div>
                  </div>

                  <Button onClick={() => void upload()} disabled={uploading || !uploadFile}>
                    {uploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
