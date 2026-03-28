import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { RegisterRequest } from '../types'
import { useState } from 'react'

export default function RegisterPage() {
  const { register: registerUser } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterRequest>()

  const onSubmit = async (data: RegisterRequest) => {
    setServerError('')
    try {
      await registerUser(data)
      navigate('/tasks')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setServerError(e.response?.data?.detail || 'Помилка реєстрації')
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center p-4">
      <div className="bg-white rounded shadow-[0_2px_12px_rgba(0,0,0,0.12)] w-full max-w-sm p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 bg-[#e53935] rounded flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <span className="text-[18px] font-bold text-[#333]">Task Manager</span>
        </div>

        <h1 className="text-[16px] font-semibold text-center text-[#333] mb-1">Реєстрація</h1>
        <p className="text-center text-[#999] text-[13px] mb-6">Створіть новий акаунт</p>

        {serverError && (
          <div className="bg-[#ffebee] border border-[#ef9a9a] text-[#b71c1c] px-4 py-2 rounded-[3px] mb-4 text-[13px]">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#666] mb-1">Повне ім'я</label>
            <input
              type="text"
              {...register('full_name')}
              className="w-full px-3 py-1.5 border border-[#e0e0e0] rounded-[3px] text-[13px] focus:outline-none focus:border-[#1a73e8] transition-colors"
              placeholder="Ваше ім'я"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#666] mb-1">Email</label>
            <input
              type="email"
              {...register('email', { required: 'Email обов\'язковий' })}
              className="w-full px-3 py-1.5 border border-[#e0e0e0] rounded-[3px] text-[13px] focus:outline-none focus:border-[#1a73e8] transition-colors"
              placeholder="you@example.com"
            />
            {errors.email && <p className="mt-1 text-[11px] text-[#e53935]">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#666] mb-1">Пароль</label>
            <input
              type="password"
              {...register('password', { required: 'Пароль обов\'язковий', minLength: { value: 8, message: 'Мінімум 8 символів' } })}
              className="w-full px-3 py-1.5 border border-[#e0e0e0] rounded-[3px] text-[13px] focus:outline-none focus:border-[#1a73e8] transition-colors"
              placeholder="••••••••"
            />
            {errors.password && <p className="mt-1 text-[11px] text-[#e53935]">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#e53935] text-white py-2 rounded-[3px] text-[13px] font-semibold hover:bg-[#c62828] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-2"
          >
            {isSubmitting ? 'Реєстрація...' : 'Зареєструватись'}
          </button>
        </form>

        <p className="text-center text-[13px] text-[#666] mt-4">
          Вже є акаунт?{' '}
          <Link to="/login" className="text-[#1a73e8] hover:text-[#1557b0] font-medium">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  )
}
