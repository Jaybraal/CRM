'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, getAllOrganizations, getCategories, getActivityLog } from '@/lib/firestore'
import { Bell, Plus, ChevronDown, Sun, Moon, Building2, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import ClientForm from '@/components/clients/ClientForm'
import type { Category, ActivityLog, Organization } from '@/types'

export default function TopBar() {
  const { profile, switchOrg } = useAuth()
  const router = useRouter()
  const [orgName, setOrgName] = useState('Mi negocio')
  const [darkMode, setDarkMode] = useState(false)

  // Nuevo Lead modal
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  // Notifications dropdown
  const [showNotifs, setShowNotifs] = useState(false)
  const [notifs, setNotifs] = useState<ActivityLog[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)

  // Business switcher dropdown
  const [showOrgMenu, setShowOrgMenu] = useState(false)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const orgMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profile?.orgId) return
    getOrganization(profile.orgId)
      .then(org => { if (org?.name) setOrgName(org.name) })
      .catch(() => {})
  }, [profile?.orgId])

  useEffect(() => {
    const root = document.documentElement
    if (darkMode) root.classList.add('dark')
    else root.classList.remove('dark')
  }, [darkMode])

  // Load categories when lead modal opens
  useEffect(() => {
    if (!showLeadModal || !profile?.orgId) return
    getCategories(profile.orgId).then(setCategories).catch(() => {})
  }, [showLeadModal, profile?.orgId])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) setShowOrgMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleOpenNotifs() {
    if (showNotifs) { setShowNotifs(false); return }
    setShowNotifs(true)
    if (!profile?.orgId || notifs.length > 0) return
    setLoadingNotifs(true)
    getActivityLog(profile.orgId, 10)
      .then(setNotifs)
      .catch(() => {})
      .finally(() => setLoadingNotifs(false))
  }

  function handleOpenOrgMenu() {
    if (showOrgMenu) { setShowOrgMenu(false); return }
    setShowOrgMenu(true)
    if (orgs.length > 0) return
    setLoadingOrgs(true)
    getAllOrganizations()
      .then(setOrgs)
      .catch(() => {})
      .finally(() => setLoadingOrgs(false))
  }

  function handleSwitchOrg(orgId: string, name: string) {
    switchOrg(orgId)
    setOrgName(name)
    setShowOrgMenu(false)
    router.refresh()
  }

  const initials = profile?.displayName
    ? profile.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  function formatNotifTime(date: Date) {
    const d = date instanceof Date ? date : new Date((date as any).seconds * 1000)
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs}h`
    return `hace ${Math.floor(hrs / 24)}d`
  }

  const actionLabel: Record<string, string> = {
    created: 'creó',
    updated: 'actualizó',
    deleted: 'eliminó',
    stage_changed: 'cambió etapa de',
    assigned: 'asignó',
  }

  return (
    <>
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-8 flex-shrink-0 shadow-sm z-20">

        {/* Left: business selector */}
        <div className="relative" ref={orgMenuRef}>
          <button
            onClick={handleOpenOrgMenu}
            className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
          >
            <div className="w-3 h-3 rounded-full bg-blue-600 flex-shrink-0" />
            <div className="hidden sm:block text-left">
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-0.5">Negocio Activo</p>
              <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{orgName}</span>
            </div>
            <ChevronDown size={15} className={`text-slate-400 group-hover:text-blue-500 transition-all ${showOrgMenu ? 'rotate-180' : ''}`} />
          </button>

          {showOrgMenu && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 py-2 overflow-hidden">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4 py-2">Cambiar negocio</p>
              {loadingOrgs ? (
                <p className="text-sm text-slate-500 px-4 py-3">Cargando...</p>
              ) : orgs.length === 0 ? (
                <p className="text-sm text-slate-500 px-4 py-3">Sin negocios disponibles</p>
              ) : orgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id, org.name)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <Building2 size={15} className="text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{org.name}</span>
                  {org.id === profile?.orgId && <Check size={14} className="text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
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
          <div className="relative" ref={notifsRef}>
            <button
              onClick={handleOpenNotifs}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl relative hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Bell size={19} />
              {notifs.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900" />
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-200">Actividad reciente</p>
                  <button
                    onClick={() => { setNotifs([]); setShowNotifs(false); router.push('/dashboard/reports') }}
                    className="text-xs text-blue-600 hover:underline font-semibold"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {loadingNotifs ? (
                    <p className="text-sm text-slate-500 px-4 py-4 text-center">Cargando...</p>
                  ) : notifs.length === 0 ? (
                    <p className="text-sm text-slate-500 px-4 py-4 text-center">Sin actividad reciente</p>
                  ) : notifs.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                          {n.actorName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">
                          <span className="font-bold">{n.actorName}</span>{' '}
                          {actionLabel[n.action] || n.action}{' '}
                          <span className="font-semibold">{n.entityType}</span>
                          {n.detail ? `: ${n.detail}` : ''}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatNotifTime(n.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Nuevo Lead */}
          <button
            onClick={() => setShowLeadModal(true)}
            className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 hover:scale-105"
          >
            <Plus size={16} />
            Nuevo Lead
          </button>

          {/* Avatar */}
          <div
            onClick={() => router.push('/dashboard/settings')}
            className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md cursor-pointer hover:scale-105 transition-transform"
          >
            {initials}
          </div>
        </div>
      </header>

      {/* Modal Nuevo Lead */}
      <Modal open={showLeadModal} onClose={() => setShowLeadModal(false)} title="Nuevo Lead" size="lg">
        <ClientForm
          categories={categories}
          existing={null}
          onSuccess={() => {
            setShowLeadModal(false)
            router.refresh()
          }}
        />
      </Modal>
    </>
  )
}
