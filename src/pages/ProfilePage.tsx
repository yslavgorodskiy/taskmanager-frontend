import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../api/auth'

interface ProfileFormData {
  full_name: string
}

interface PasswordFormData {
  password: string
  confirm_password: string
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const profileForm = useForm<ProfileFormData>({
    defaultValues: { full_name: user?.full_name ?? '' },
  })

  const passwordForm = useForm<PasswordFormData>()

  const handleProfileSubmit = async (data: ProfileFormData) => {
    setProfileError('')
    setProfileSuccess('')
    try {
      await authApi.updateMe({ full_name: data.full_name || undefined })
      await refreshUser()
      setProfileSuccess('Profile updated successfully')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setProfileError(e.response?.data?.detail || 'Failed to update profile')
    }
  }

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setPasswordError('')
    setPasswordSuccess('')
    if (data.password !== data.confirm_password) {
      setPasswordError('Passwords do not match')
      return
    }
    try {
      await authApi.updateMe({ password: data.password })
      setPasswordSuccess('Password changed successfully')
      passwordForm.reset()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setPasswordError(e.response?.data?.detail || 'Failed to change password')
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your account settings</p>
      </div>

      {/* Account info */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-indigo-700">
              {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-lg">{user?.full_name || '(no name set)'}</h2>
            <p className="text-slate-500 text-sm">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                user?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {user?.is_active ? 'Active' : 'Inactive'}
              </span>
              {user?.is_superuser && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  Superuser
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="text-sm text-slate-500">
          Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
        </div>
      </div>

      {/* Edit profile */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Edit Profile</h2>

        {profileSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {profileSuccess}
          </div>
        )}
        {profileError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {profileError}
          </div>
        )}

        <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email ?? ''}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-400">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              {...profileForm.register('full_name')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Your full name"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileForm.formState.isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {profileForm.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-base font-semibold text-slate-900 mb-4">Change Password</h2>

        {passwordSuccess && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {passwordSuccess}
          </div>
        )}
        {passwordError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
            {passwordError}
          </div>
        )}

        <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
            <input
              type="password"
              {...passwordForm.register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
              })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            {passwordForm.formState.errors.password && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
            <input
              type="password"
              {...passwordForm.register('confirm_password', { required: 'Please confirm your password' })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
            {passwordForm.formState.errors.confirm_password && (
              <p className="mt-1 text-xs text-red-600">{passwordForm.formState.errors.confirm_password.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordForm.formState.isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
            >
              {passwordForm.formState.isSubmitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
