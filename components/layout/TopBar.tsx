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

  const [showLeadModal, setShowLeadModal] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])

  const [showNotifs, setShowNotifs] = useState(false)
  const [notifs, setNotifs] = useState<ActivityLog[]>([])
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const notifsRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!showLeadModal || !profile?.orgId) return
    getCategories(profile.orgId).then(setCategories).catch(() => {})
  }, [showLeadModal, profile?.orgId])

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
      <header className="h-14 bg-white dark:bg-[#0F1829] border-b border-[#E3E6EC] dark:border-[#1A2540] flex items-center justify-between px-4 sm:px-6 flex-shrink-0 z-20">

        {/* Left: business selector */}
        <div className="relative" ref={orgMenuRef}>
          <button
            onClick={handleOpenOrgMenu}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded border border-[#E3E6EC] dark:border-[#1A2540] hover:border-[#0D7A65] dark:hover:border-[#0D7A65] transition-colors group"
          >
            <div className="w-2 h-2 rounded-full bg-[#0D7A65] flex-shrink-0" />
            <div className="hidden sm:block text-left">
              <p className="text-[9px] text-[#9BA5B7] font-semibold uppercase tracking-wider leading-none mb-0.5">Negocio</p>
              <span className="text-sm font-semibold text-[#0C1224] dark:text-[#E8ECF4] leading-none">{orgName}</span>
            </div>
            <ChevronDown size={13} className={`text-[#9BA5B7] group-hover:text-[#0D7A65] transition-all flex-shrink-0 ${showOrgMenu ? 'rotate-180' : ''}`} />
          </button>

          {showOrgMenu && (
            <div className="absolute left-0 top-full mt-1.5 w-60 bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-lg z-50 py-1.5 overflow-hidden">
              <p className="text-[9px] font-semibold text-[#9BA5B7] uppercase tracking-wider px-3.5 py-2">Cambiar negocio</p>
              {loadingOrgs ? (
                <p className="text-sm text-[#68748D] px-3.5 py-3">Cargando...</p>
              ) : orgs.length === 0 ? (
                <p className="text-sm text-[#68748D] px-3.5 py-3">Sin negocios disponibles</p>
              ) : orgs.map(org => (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id, org.name)}
                  className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors text-left"
                >
                  <Building2 size={13} className="text-[#0D7A65] flex-shrink-0" />
                  <span className="text-sm text-[#0C1224] dark:text-[#E8ECF4] flex-1 truncate">{org.name}</span>
                  {org.id === profile?.orgId && <Check size={13} className="text-[#0D7A65] flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">

          {/* Dark / Light toggle */}
          <div className="hidden sm:flex items-center gap-0.5 bg-[#F4F5F7] dark:bg-[#1A2540] p-0.5 rounded border border-[#E3E6EC] dark:border-[#1A2540]">
            <button
              onClick={() => setDarkMode(false)}
              className={`p-1.5 rounded transition-all ${!darkMode ? 'bg-white text-[#0D7A65] shadow-sm' : 'text-[#9BA5B7] hover:text-[#68748D]'}`}
            >
              <Sun size={14} />
            </button>
            <button
              onClick={() => setDarkMode(true)}
              className={`p-1.5 rounded transition-all ${darkMode ? 'bg-[#0F1829] text-[#0D7A65] shadow-sm' : 'text-[#9BA5B7] hover:text-[#68748D]'}`}
            >
              <Moon size={14} />
            </button>
          </div>

          {/* Bell */}
          <div className="relative" ref={notifsRef}>
            <button
              onClick={handleOpenNotifs}
              className="p-2 rounded border border-transparent hover:border-[#E3E6EC] dark:hover:border-[#1A2540] text-[#68748D] hover:text-[#0C1224] dark:hover:text-[#E8ECF4] transition-colors relative"
            >
              <Bell size={17} />
              {notifs.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E3E6EC] dark:border-[#1A2540]">
                  <p className="text-xs font-semibold text-[#0C1224] dark:text-[#E8ECF4] uppercase tracking-wider">Actividad reciente</p>
                  <button
                    onClick={() => { setNotifs([]); setShowNotifs(false); router.push('/dashboard/reports') }}
                    className="text-xs text-[#0D7A65] hover:underline font-semibold"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {loadingNotifs ? (
                    <p className="text-sm text-[#68748D] px-4 py-4 text-center">Cargando...</p>
                  ) : notifs.length === 0 ? (
                    <p className="text-sm text-[#68748D] px-4 py-4 text-center">Sin actividad reciente</p>
                  ) : notifs.map(n => (
                    <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors border-b border-[#E3E6EC]/60 dark:border-[#1A2540] last:border-0">
                      <div className="w-7 h-7 rounded bg-[#0D7A65]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[11px] font-semibold text-[#0D7A65]">
                          {n.actorName?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#0C1224] dark:text-[#E8ECF4] leading-snug">
                          <span className="font-semibold">{n.actorName}</span>{' '}
                          {actionLabel[n.action] || n.action}{' '}
                          <span className="font-semibold">{n.entityType}</span>
                          {n.detail ? `: ${n.detail}` : ''}
                        </p>
                        <p className="text-[10px] text-[#9BA5B7] mt-0.5">{formatNotifTime(n.createdAt)}</p>
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
            className="hidden sm:flex items-center gap-1.5 bg-[#0C1224] dark:bg-[#0D7A65] hover:bg-[#1B2B4B] dark:hover:bg-[#0B6B57] text-white px-3.5 py-2 rounded text-xs font-semibold transition-colors"
          >
            <Plus size={13} />
            Nuevo Lead
          </button>

          {/* Avatar */}
          <div
            onClick={() => router.push('/dashboard/settings')}
            className="w-8 h-8 rounded-md bg-[#0D7A65] flex items-center justify-center text-white font-semibold text-xs cursor-pointer hover:bg-[#0B6B57] transition-colors select-none"
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
