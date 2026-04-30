'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization } from '@/lib/firestore'
import { Bell, Plus, ChevronDown, Sun, Moon, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function TopBar() {
  const { profile } = useAuth()
  const router = useRouter()
  const [orgName, setOrgName] = useState('Mi negocio')
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (!profile?.orgId) return
    getOrganization(profile.orgId)
      .then(org => { if (org?.name) setOrgName(org.name) })
      .catch(() => {})
  }, [profile?.orgId])

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [darkMode])

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 flex-shrink-0 shadow-sm z-20">

      {/* Left: business selector */}
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
          <div className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
          <div className="hidden sm:block text-left">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">Negocio Activo</p>
            <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{orgName}</span>
          </div>
          <ChevronDown size={15} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-3">

        {/* Dark / Light toggle */}
        <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setDarkMode(false)}
            className={`p-2 rounded-lg transition-all ${!darkMode ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Sun size={17} />
          </button>
          <button
            onClick={() => setDarkMode(true)}
            className={`p-2 rounded-lg transition-all ${darkMode ? 'bg-slate-700 text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Moon size={17} />
          </button>
        </div>

        {/* Bell */}
        <button className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl relative hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          <Bell size={19} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>

        {/* Nuevo Lead */}
        <button
          onClick={() => router.push('/dashboard/clients')}
          className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
        >
          <Plus size={16} />
          Nuevo Lead
        </button>

        {/* Avatar */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md cursor-pointer hover:scale-105 transition-transform">
          {initials}
        </div>
      </div>
    </header>
  )
}
