import { Outlet, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* CMW-style header */}
      <header className="bg-white border-b border-[#e0e0e0] flex-shrink-0 z-10" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.10)'}}>
        <div className="flex items-center h-12 px-4 gap-3">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-[#e53935] rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="text-sm font-bold text-[#333333]">Task Manager</span>
          </div>

          <div className="relative ml-2">
            <svg className="w-3.5 h-3.5 text-[#999] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input placeholder="Пошук" className="pl-8 pr-3 py-1.5 bg-[#f5f5f5] border border-[#e0e0e0] rounded-[20px] text-[13px] text-[#333] w-60 outline-none focus:border-[#1a73e8] focus:bg-white transition-colors" />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2 relative group">
            <span className="text-[13px] text-[#666] truncate max-w-[180px]">{user?.email}</span>
            <Link to="/profile" className="w-7 h-7 bg-[#e53935] rounded-full flex items-center justify-center text-[11px] font-bold text-white hover:bg-[#c62828] transition-colors flex-shrink-0">
              {initials}
            </Link>
            <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-[#e0e0e0] rounded shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {[{to:'/',label:'Задачі'},{to:'/profile',label:'Профіль'},{to:'/directions',label:'Напрямки'},{to:'/tags',label:'Теги'},{to:'/tokens',label:'API Tokens'},{to:'/webhooks',label:'Webhooks'}].map(({to,label})=>(
                <Link key={to} to={to} className="block px-3 py-1.5 text-[13px] text-[#333] hover:bg-[#f5f5f5] transition-colors">{label}</Link>
              ))}
              <div className="border-t border-[#e0e0e0] my-1" />
              <button onClick={handleLogout} className="block w-full text-left px-3 py-1.5 text-[13px] text-[#e53935] hover:bg-[#fff5f5] transition-colors">Вийти</button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
