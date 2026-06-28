'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization } from '@/lib/firestore'
import type { Organization, BotLead } from '@/types'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PageHeader, Card, SectionHeader, Spinner } from '@/components/ui/primitives'
import { Bot, Settings } from 'lucide-react'
import Link from 'next/link'

export default function BotPage() {
  const { profile } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [botLeads, setBotLeads] = useState<BotLead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }

    Promise.all([
      getOrganization(profile.orgId),
      getDocs(
        query(
          collection(db, 'organizations', profile.orgId, 'bot_leads'),
          orderBy('createdAt', 'desc'),
          limit(10)
        )
      ),
    ]).then(([o, snap]) => {
      setOrg(o)
      const leads = snap.docs.map(d => {
        const data = d.data()
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt?.seconds * 1000 || Date.now()),
        } as BotLead
      })
      setBotLeads(leads)
    }).finally(() => setLoading(false))
  }, [profile])

  if (loading) return <Spinner />

  const isActive = org?.settings.n8nMode !== 'off' && !!org?.settings.n8nWebhookUrl

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayLeads = botLeads.filter(l => {
    const d = l.createdAt instanceof Date ? l.createdAt : new Date((l.createdAt as unknown as { seconds: number }).seconds * 1000)
    return d >= today
  }).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Bot N8N" subtitle="Leads calificados automáticamente por tu flujo de N8N" />
        <Link
          href="/dashboard/settings?tab=bot"
          className="flex items-center gap-2 px-4 py-2 bg-[#0C1224] hover:bg-[#1B2B4B] text-white text-sm font-bold rounded-md transition-colors"
        >
          <Settings size={14} />
          Configurar Bot
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isActive ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-[#F4F5F7] dark:bg-[#1A2540]'}`}>
            <Bot size={18} className={isActive ? 'text-emerald-600' : 'text-[#9BA5B7]'} />
          </div>
          <div>
            <p className="text-xs text-[#9BA5B7] font-medium">Estado</p>
            <p className={`text-sm font-bold ${isActive ? 'text-emerald-600' : 'text-[#9BA5B7]'}`}>
              {isActive ? '● Bot activo' : '● Inactivo'}
            </p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#0D7A65]/10 flex items-center justify-center">
            <span className="text-[#0D7A65] font-bold text-lg">{todayLeads}</span>
          </div>
          <div>
            <p className="text-xs text-[#9BA5B7] font-medium">Leads hoy</p>
            <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Calificados hoy</p>
          </div>
        </Card>

        <Card className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#0D7A65]/10 flex items-center justify-center">
            <span className="text-[#0D7A65] font-bold text-lg">{botLeads.length}</span>
          </div>
          <div>
            <p className="text-xs text-[#9BA5B7] font-medium">Total recientes</p>
            <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Últimos 10 leads</p>
          </div>
        </Card>
      </div>

      {/* Leads table */}
      <Card className="space-y-4">
        <SectionHeader icon={Bot} title="Leads recientes del bot" />
        {botLeads.length === 0 ? (
          <div className="py-8 text-center">
            <Bot size={32} className="text-[#9BA5B7] mx-auto mb-3" />
            <p className="text-sm text-[#68748D] dark:text-[#9BA5B7]">
              {isActive
                ? 'Aún no hay leads calificados por el bot.'
                : 'El bot está inactivo. Configúralo para empezar a calificar leads.'}
            </p>
            {!isActive && (
              <Link
                href="/dashboard/settings?tab=bot"
                className="inline-flex items-center gap-1.5 mt-3 text-sm text-[#0D7A65] font-semibold hover:underline"
              >
                <Settings size={13} /> Configurar ahora
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E3E6EC] dark:border-[#1A2540]">
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#9BA5B7] uppercase tracking-wide">Nombre</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#9BA5B7] uppercase tracking-wide">Teléfono</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#9BA5B7] uppercase tracking-wide hidden sm:table-cell">Resumen</th>
                  <th className="text-left py-2 px-3 text-xs font-bold text-[#9BA5B7] uppercase tracking-wide hidden md:table-cell">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {botLeads.map(lead => {
                  const date = lead.createdAt instanceof Date
                    ? lead.createdAt
                    : new Date((lead.createdAt as unknown as { seconds: number }).seconds * 1000)
                  return (
                    <tr key={lead.id} className="border-b border-[#E3E6EC] dark:border-[#1A2540] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[#0C1224] dark:text-[#E8ECF4]">{lead.name}</td>
                      <td className="py-2.5 px-3 text-[#68748D] dark:text-[#9BA5B7] font-mono text-xs">{lead.phone}</td>
                      <td className="py-2.5 px-3 text-[#68748D] dark:text-[#9BA5B7] hidden sm:table-cell max-w-xs truncate">{lead.summary}</td>
                      <td className="py-2.5 px-3 text-[#9BA5B7] text-xs hidden md:table-cell whitespace-nowrap">
                        {date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
