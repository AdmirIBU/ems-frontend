import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type AdminUser = {
  id: string
  name: string
  email: string
  role: 'student' | 'professor' | 'admin'
  createdAt?: string
}

export function AdminUsersPage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'professor'>('student')
  const [creating, setCreating] = useState(false)

  const authHeaders = useMemo(() => {
    return {
      Authorization: `Bearer ${token ?? ''}`,
      'Content-Type': 'application/json',
    }
  }, [token])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      })
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    if (password.trim().length < 6) {
      setCreating(false)
      setError('Password must be at least 6 characters')
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name, email, password, role }),
      })

      if (!res.ok) {
        let msg = 'Failed to create user'
        try {
          const body = await res.json()
          if (Array.isArray(body?.errors) && body.errors.length > 0) {
            msg = String(body.errors[0]?.msg ?? msg)
          } else if (body?.error) {
            msg = String(body.error)
          } else if (body?.message) {
            msg = String(body.message)
          }
        } catch {
          const txt = await res.text().catch(() => '')
          if (txt) msg = txt
        }
        throw new Error(msg)
      }

      setName('')
      setEmail('')
      setPassword('')
      setRole('student')
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Admin: Create User</CardTitle>
            <CardDescription>Create student or professor accounts</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              {error && <div className="text-sm text-red-600">{error}</div>}
              <Input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
              <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input
                type="password"
                placeholder="Temporary password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <label className="block text-sm">
                Role
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'student' | 'professor')}
                >
                  <option value="student">Student</option>
                  <option value="professor">Professor</option>
                </select>
              </label>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? 'Creating...' : 'Create User'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>{loading ? 'Loading…' : `${users.length} total`}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button type="button" variant="outline" onClick={() => void loadUsers()} disabled={loading}>
                Refresh
              </Button>
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="border rounded p-3 text-sm">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-gray-600">{u.email}</div>
                    <div className="text-gray-600">Role: {u.role}</div>
                  </div>
                ))}
                {!loading && users.length === 0 && <div className="text-sm text-gray-600">No users found.</div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
