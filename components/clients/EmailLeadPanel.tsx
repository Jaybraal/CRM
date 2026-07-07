'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import type { Client } from '@/types'
import toast from 'react-hot-toast'
import { Mail, Send, Square, Eye, ArrowLeft, Globe, MapPin, Inbox } from 'lucide-react'
import { collection, query, orderBy, onSnapshot, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getCampaign } from '@/lib/outreach/campaigns'

interface OutreachPreviewEmail {
  step: number
  subject: string
  body: string
}

interface EmailThreadItem {
  id: string
  subject?: string
  body?: string
  direction: 'inbound' | 'outbound'
  createdAt?: Timestamp
  outreachStep?: number
}

interface Props {
  client: Client
  orgId: string
  onBack?: () => void
}

const STEP_LABEL: Record<number, string> = { 0: 'Día 0', 5: 'Día 5', 10: 'Día 10', 20: 'Día 20' }

function formatDate(ts?: Timestamp): string {
  if (!ts) return ''
  return ts.toDate().toLocaleString('es', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function EmailLeadPanel({ client, orgId, onBack }: Props) {
  const { user } = useAuth()
  const [loading, setLoading] = useState<'preview' | 'enroll' | 'stop' | null>(null)
  const [preview, setPreview] = useState<OutreachPreviewEmail[] | null>(null)
  const [thread, setThread] = useState<EmailThreadItem[]>([])
  const outreachStatus = client.outreachStatus
  const campaign = getCampaign(client.product)

  // Historial real de correos (enviados + respuestas) — en vivo.
  useEffect(() => {
    const q = query(
      collection(db, `organizations/${orgId}/clients/${client.id}/emails`),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, snap => {
      setThread(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<EmailThreadItem, 'id'>) })))
    })
    return unsub
  }, [orgId, client.id])

  // Al abrir el lead, marcar como leído (mismo patrón que WhatsApp/Instagram).
  useEffect(() => {
    if ((client.unreadCount ?? 0) > 0) {
      updateDoc(doc(db, `organizations/${orgId}/clients/${client.id}`), { unreadCount: 0 }).catch(() => {})
    }
  }, [orgId, client.id, client.unreadCount])

  const call = async (action: 'preview' | 'enroll' | 'stop') => {
    if (!user) return
    setLoading(action)
    try {
      const token = await user.getIdToken()
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, orgId, clientId: client.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error')
      if (action === 'preview') setPreview(data.emails)
      if (action === 'enroll') { toast.success(`Secuencia activada (${data.steps} correos programados)`); setPreview(null) }
      if (action === 'stop') { toast.success(`Secuencia detenida (${data.stopped} pendientes cancelados)`); setPreview(null) }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al procesar la secuencia')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F4F5F7] dark:bg-[#0F1829]">
      {/* Header — deliberadamente distinto al de WhatsApp/Instagram: esto no es un chat en vivo */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#0F1829] border-b border-[#E3E6EC] dark:border-[#1A2540]">
        {onBack && (
          <button onClick={onBack} className="lg:hidden p-1 text-[#68748D]"><ArrowLeft size={18} /></button>
        )}
        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
          <Mail size={16} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm text-[#0C1224] dark:text-[#E8ECF4] truncate">{client.name}</p>
          <p className="text-xs text-[#68748D] truncate">{client.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {campaign.businessLabel}
          </span>
          {outreachStatus && (
            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
              outreachStatus === 'enrolled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>{outreachStatus === 'enrolled' ? 'Secuencia activa' : 'Detenida'}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Ficha del lead */}
        <div className="bg-white dark:bg-[#0F1829] rounded-lg border border-[#E3E6EC] dark:border-[#1A2540] p-4 space-y-2">
          <p className="text-xs font-bold uppercase text-[#9BA5B7] mb-1">Lead de email — captación {campaign.businessLabel}</p>
          {client.specialty && <p className="text-sm text-[#0C1224] dark:text-[#E8ECF4]">{client.specialty}</p>}
          {client.city && (
            <p className="text-sm text-[#68748D] flex items-center gap-1.5"><MapPin size={13} /> {client.city}{client.country ? `, ${client.country}` : ''}</p>
          )}
          {client.website && (
            <p className="text-sm text-[#68748D] flex items-center gap-1.5"><Globe size={13} /> {client.website}</p>
          )}
          {client.phone && <p className="text-sm text-[#68748D]">Tel. negocio: {client.phone}</p>}
          {client.notes && <p className="text-xs text-[#9BA5B7] italic mt-2">{client.notes}</p>}
        </div>

        {/* Acciones de secuencia */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => call('preview')} disabled={loading !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-white dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#2A3550] text-[#0C1224] dark:text-[#E8ECF4] hover:bg-[#F4F5F7] disabled:opacity-50">
            <Eye size={14} /> {loading === 'preview' ? 'Cargando...' : `Ver secuencia (${campaign.steps.length} correos)`}
          </button>
          {outreachStatus !== 'enrolled' ? (
            <button onClick={() => call('enroll')} disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-[#0D7A65] text-white hover:bg-[#0a5f4f] disabled:opacity-50">
              <Send size={14} /> {loading === 'enroll' ? 'Activando...' : 'Activar secuencia'}
            </button>
          ) : (
            <button onClick={() => call('stop')} disabled={loading !== null}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 disabled:opacity-50">
              <Square size={14} /> {loading === 'stop' ? 'Deteniendo...' : 'Detener secuencia'}
            </button>
          )}
        </div>

        {/* Preview de los correos de la secuencia */}
        {preview && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase text-[#9BA5B7]">Vista previa de la secuencia</p>
            {preview.map(e => (
              <div key={e.step} className="bg-white dark:bg-[#0F1829] rounded-lg border border-[#E3E6EC] dark:border-[#1A2540] p-3">
                <p className="text-[10px] font-bold uppercase text-[#0D7A65] mb-1">{STEP_LABEL[e.step] || `Día ${e.step}`}</p>
                <p className="text-sm font-semibold text-[#0C1224] dark:text-[#E8ECF4] mb-1">{e.subject}</p>
                <p className="text-xs text-[#68748D] whitespace-pre-line">{e.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Historial real: correos enviados + respuestas del lead */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-[#9BA5B7] flex items-center gap-1.5"><Inbox size={12} /> Historial de correos</p>
          {thread.length === 0 ? (
            <p className="text-xs text-[#9BA5B7]">Sin correos enviados o recibidos todavía.</p>
          ) : (
            thread.map(e => (
              <div key={e.id} className={`rounded-lg border p-3 ${
                e.direction === 'inbound'
                  ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'
                  : 'bg-white dark:bg-[#0F1829] border-[#E3E6EC] dark:border-[#1A2540]'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold uppercase ${e.direction === 'inbound' ? 'text-emerald-600' : 'text-[#68748D]'}`}>
                    {e.direction === 'inbound' ? 'Respuesta del lead' : (e.outreachStep !== undefined ? STEP_LABEL[e.outreachStep] || `Día ${e.outreachStep}` : 'Enviado')}
                  </span>
                  <span className="text-[10px] text-[#9BA5B7]">{formatDate(e.createdAt)}</span>
                </div>
                {e.subject && <p className="text-sm font-semibold text-[#0C1224] dark:text-[#E8ECF4] mb-1">{e.subject}</p>}
                <p className="text-xs text-[#68748D] whitespace-pre-line">{e.body}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
