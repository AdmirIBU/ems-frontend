import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ProfilePage() {
  const API_BASE = import.meta.env.VITE_API_URL ?? ''
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const [user, setUser] = useState<any>(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null
    return raw ? JSON.parse(raw) : null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMessage, setPwMessage] = useState<string | null>(null)

  const profileFields: Array<{ key: string; label: string }> = [
    { key: '_id', label: 'User ID' },
    { key: 'name', label: 'Full name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'createdAt', label: 'Created at' },
    { key: 'updatedAt', label: 'Updated at' },
  ]

  const formatProfileValue = (key: string, value: any) => {
    if (value == null) return '—'
    if (key === 'createdAt' || key === 'updatedAt') {
      const d = new Date(String(value))
      return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(value)
    }
    return String(value)
  }

  useEffect(() => {
    async function load() {
      if (!token) return
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`${API_BASE}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(txt || 'Failed to load profile')
        }
        const data = await res.json()
        setUser(data)
        // keep local copy in sync for other pages
        localStorage.setItem('user', JSON.stringify(data))
      } catch (err: any) {
        setError(err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [API_BASE, token])

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Profile</h1>
          <div className="bg-white border rounded p-6">
            <p className="text-sm text-gray-600">Please <Link to="/login" className="text-blue-600 hover:underline">log in</Link> to view your profile.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>

        <div className="bg-white border rounded p-6">
          {loading ? (
            <p>Loading...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-xl">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                <div>
                  <h2 className="text-lg font-semibold">{user?.name || 'Unknown User'}</h2>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700">Role</h3>
                  <p className="mt-1 text-sm">{user?.role || 'student'}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700">Member since</h3>
                  <p className="mt-1 text-sm">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</p>
                </div>
              </div>

              <hr className="my-4" />

              <h3 className="text-sm font-medium text-gray-700 mb-2">Change password</h3>
              {pwMessage && <p className="text-sm mb-2">{pwMessage}</p>}
              <form
                className="grid gap-2 grid-cols-1 sm:grid-cols-3"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!token) return
                  setPwSaving(true)
                  setPwMessage(null)
                  try {
                    const res = await fetch(`${API_BASE}/api/users/change-password`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ currentPassword, newPassword }),
                    })
                    const data = await res.json().catch(() => null)
                    if (!res.ok) throw new Error(data?.error || 'Failed to change password')
                    setCurrentPassword('')
                    setNewPassword('')
                    setPwMessage('Password changed successfully.')
                  } catch (err: any) {
                    setPwMessage(err.message || 'Failed to change password')
                  } finally {
                    setPwSaving(false)
                  }
                }}
              >
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                <Button type="submit" disabled={pwSaving}>
                  {pwSaving ? 'Updating...' : 'Update password'}
                </Button>
              </form>

              <hr className="my-4" />

              <h3 className="text-sm font-medium text-gray-700 mb-2">Other details</h3>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {profileFields
                  .filter((f) => user && Object.prototype.hasOwnProperty.call(user, f.key))
                  .map((f) => (
                    <div key={f.key} className="flex justify-between border rounded p-2 bg-gray-50">
                      <div className="font-medium text-gray-700">{f.label}</div>
                      <div className="text-gray-600">{formatProfileValue(f.key, user?.[f.key])}</div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
