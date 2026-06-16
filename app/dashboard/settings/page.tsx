'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, getWhatsAppTemplates, getWebhooks, createWebhook, updateWebhook, deleteWebhook, getCaptureForms, createCaptureForm, deleteCaptureForm } from '@/lib/firestore'
import type { Organization, WhatsAppTemplate, PipelineStage, QualificationQuestion, QualificationQuestionType, ClientStatus, Webhook, WebhookEvent, CaptureForm, CaptureFormField } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import InstagramConnect from '@/components/settings/InstagramConnect'
import {
  Building2, MessageCircle, Instagram, Copy, CheckCircle, Plus, Trash2,
  GitBranch, Bot, Wrench, ClipboardList, GripVertical, Tag, Users,
  Webhook as WebhookIcon, CreditCard, FormInput, ExternalLink, Clock
} from 'lucide-react'
import { Card, SectionHeader, Toggle, Spinner, PageHeader, inputClass, labelClass } from '@/components/ui/primitives'

type Tab = 'general' | 'conexiones' | 'pipeline' | 'mensajes' | 'avanzado'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'general',    label: 'General',     icon: Building2 },
  { id: 'conexiones', label: 'Conexiones',  icon: MessageCircle },
  { id: 'pipeline',   label: 'Pipeline',    icon: GitBranch },
  { id: 'mensajes',   label: 'Mensajes',    icon: Bot },
  { id: 'avanzado',   label: 'Avanzado',    icon: Wrench },
]

export default function SettingsPage() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', industry: '', whatsappNumber: '', websiteUrl: '' })
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', body: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [newStage, setNewStage] = useState({ name: '', color: '#6b7280' })
  const [savingStage, setSavingStage] = useState(false)
  const [clientStatuses, setClientStatuses] = useState<ClientStatus[]>(DEFAULT_CLIENT_STATUSES)
  const [newStatus, setNewStatus] = useState({ value: '', label: '' })
  const [savingStatuses, setSavingStatuses] = useState(false)
  const [autoReply, setAutoReply] = useState({ enabled: false, message: '' })
  const [savingAutoReply, setSavingAutoReply] = useState(false)
  const [windowMsg, setWindowMsg] = useState({ enabled: false, message: '', delayHours: 23 })
  const [savingWindowMsg, setSavingWindowMsg] = useState(false)
  const [qualForm, setQualForm] = useState<{ enabled: boolean; questions: QualificationQuestion[]; completionMessage: string }>({ enabled: false, questions: [], completionMessage: '' })
  const [newQuestion, setNewQuestion] = useState({ text: '', type: 'text' as QualificationQuestionType, autoTag: false })
  const [savingQualForm, setSavingQualForm] = useState(false)
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [newWebhook, setNewWebhook] = useState({ url: '', events: [] as WebhookEvent[] })
  const [savingWebhook, setSavingWebhook] = useState(false)
  const [captureForms, setCaptureForms] = useState<CaptureForm[]>([])
  const [showFormBuilder, setShowFormBuilder] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [newFormFields, setNewFormFields] = useState<CaptureFormField[]>([])
  const [newFormConfirmation, setNewFormConfirmation] = useState('¡Gracias! Nos pondremos en contacto pronto.')
  const [savingForm, setSavingForm] = useState(false)
  const [cleaningPhones, setCleaningPhones] = useState(false)
  const [cleaningFakes, setCleaningFakes] = useState(false)
  const [businessHours, setBusinessHours] = useState({ days: [1, 2, 3, 4, 5], openTime: '08:00', closeTime: '18:00', slotMinutes: 60 })
  const [savingBusinessHours, setSavingBusinessHours] = useState(false)

  const DEFAULT_STAGES: PipelineStage[] = [
    { id: 'new', name: 'Nuevo', order: 0, color: '#6b7280' },
    { id: 'contacted', name: 'Contactado', order: 1, color: '#3b82f6' },
    { id: 'negotiation', name: 'Negociación', order: 2, color: '#f59e0b' },
    { id: 'closed_won', name: 'Ganado', order: 3, color: '#10b981' },
    { id: 'closed_lost', name: 'Perdido', order: 4, color: '#ef4444' },
  ]

  const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
    { value: 'new_client', label: 'Nuevo cliente' },
    { value: 'new_message', label: 'Nuevo mensaje' },
    { value: 'deal_created', label: 'Deal creado' },
    { value: 'deal_closed', label: 'Deal cerrado' },
    { value: 'task_created', label: 'Tarea creada' },
  ]

  const questionTypeLabel: Record<QualificationQuestionType, string> = {
    text: 'Texto', phone: 'Teléfono', yes_no: 'Sí/No', number: 'Número',
  }
  const questionTypeBadge: Record<QualificationQuestionType, string> = {
    text: 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7]',
    phone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    yes_no: 'bg-[#0D7A65]/10 dark:bg-[#0D7A65]/10 text-blue-700 dark:text-[#0D7A65]',
    number: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  }

  useEffect(() => {
    if (!profile) return
    if (!profile.orgId) { setLoading(false); return }
    Promise.all([
      getOrganization(profile.orgId),
      getWhatsAppTemplates(profile.orgId),
      getWebhooks(profile.orgId),
      getCaptureForms(profile.orgId),
    ]).then(([o, tmpl, wh, forms]) => {
      setWebhooks(wh); setCaptureForms(forms)
      if (o) {
        setOrg(o)
        setForm({ name: o.name, industry: o.settings.industry, whatsappNumber: o.settings.whatsappNumber || '', websiteUrl: o.settings.websiteUrl || '' })
        setStages(o.settings.pipelineStages || DEFAULT_STAGES)
        setClientStatuses(o.settings.clientStatuses || DEFAULT_CLIENT_STATUSES)
        setAutoReply({ enabled: o.settings.autoReply?.enabled || false, message: o.settings.autoReply?.message || '' })
        setWindowMsg({ enabled: o.settings.windowMessage?.enabled || false, message: o.settings.windowMessage?.message || '', delayHours: o.settings.windowMessage?.delayHours ?? 23 })
        setQualForm({ enabled: o.settings.qualificationForm?.enabled || false, questions: o.settings.qualificationForm?.questions || [], completionMessage: o.settings.qualificationForm?.completionMessage || '' })
        if (o.settings.businessHours) setBusinessHours(o.settings.businessHours as typeof businessHours)
      }
      setTemplates(tmpl)
    }).catch(e => console.error(e)).finally(() => setLoading(false))
  }, [profile])

  const callApi = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: profile?.orgId, ...body }) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error desconocido')
    return data
  }

  const handleSaveBusinessHours = async () => {
    if (!profile?.orgId) return
    setSavingBusinessHours(true)
    try {
      await callApi({ action: 'save_business_hours', ...businessHours })
      toast.success('Horario guardado')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
    finally { setSavingBusinessHours(false) }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId) return; setSaving(true)
    try { await callApi({ action: 'save_org', name: form.name, industry: form.industry, whatsappNumber: form.whatsappNumber.trim(), websiteUrl: form.websiteUrl.trim() }); toast.success('Guardado') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setSaving(false) }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId || !newTemplate.name || !newTemplate.body) return; setSavingTemplate(true)
    try {
      const data = await callApi({ action: 'save_template', name: newTemplate.name, body: newTemplate.body })
      setTemplates(prev => [...prev, { id: data.id, name: newTemplate.name, body: newTemplate.body, createdAt: new Date() }])
      setNewTemplate({ name: '', body: '' }); toast.success('Plantilla guardada')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error', { duration: 6000 }) }
    finally { setSavingTemplate(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!profile?.orgId) return
    try { await callApi({ action: 'delete_template', templateId: id }); setTemplates(prev => prev.filter(t => t.id !== id)); toast.success('Eliminada') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId || !newStage.name) return; setSavingStage(true)
    try {
      const updated: PipelineStage[] = [...stages, { id: `stage_${Date.now()}`, name: newStage.name, color: newStage.color, order: stages.length }]
      await callApi({ action: 'save_pipeline_stage', stages: updated })
      setStages(updated); setNewStage({ name: '', color: '#6b7280' }); toast.success('Etapa añadida')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setSavingStage(false) }
  }

  const handleDeleteStage = async (id: string) => {
    if (!profile?.orgId) return
    const updated = stages.filter(s => s.id !== id)
    try { await callApi({ action: 'save_pipeline_stage', stages: updated }); setStages(updated) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId || !newStatus.label.trim()) return
    const value = newStatus.value.trim() || newStatus.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (clientStatuses.some(s => s.value === value)) { toast.error('Ya existe'); return }
    setSavingStatuses(true)
    try {
      const updated = [...clientStatuses, { value, label: newStatus.label.trim() }]
      await callApi({ action: 'save_client_statuses', statuses: updated })
      setClientStatuses(updated); setNewStatus({ value: '', label: '' }); toast.success('Estado añadido')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setSavingStatuses(false) }
  }

  const handleDeleteStatus = async (value: string) => {
    if (!profile?.orgId) return
    if (clientStatuses.length <= 1) { toast.error('Debe haber al menos un estado'); return }
    const updated = clientStatuses.filter(s => s.value !== value)
    try { await callApi({ action: 'save_client_statuses', statuses: updated }); setClientStatuses(updated) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleRenameStatus = async (value: string, newLabel: string) => {
    if (!profile?.orgId || !newLabel.trim()) return
    const updated = clientStatuses.map(s => s.value === value ? { ...s, label: newLabel.trim() } : s)
    try { await callApi({ action: 'save_client_statuses', statuses: updated }); setClientStatuses(updated) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') }
  }

  const handleSaveAutoReply = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId) return; setSavingAutoReply(true)
    try { await callApi({ action: 'save_autoreply', enabled: autoReply.enabled, message: autoReply.message }); toast.success('Guardado') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setSavingAutoReply(false) }
  }

  const handleSaveWindowMsg = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId) return; setSavingWindowMsg(true)
    try { await callApi({ action: 'save_window_message', enabled: windowMsg.enabled, message: windowMsg.message, delayHours: windowMsg.delayHours }); toast.success('Guardado') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setSavingWindowMsg(false) }
  }

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault(); if (!newQuestion.text.trim()) return
    const q: QualificationQuestion = { id: `q_${Date.now()}`, text: newQuestion.text.trim(), type: newQuestion.type, order: qualForm.questions.length, ...(newQuestion.autoTag ? { autoTag: true } : {}) }
    setQualForm(f => ({ ...f, questions: [...f.questions, q] }))
    setNewQuestion({ text: '', type: 'text', autoTag: false })
  }

  const handleSaveQualForm = async (e: React.FormEvent) => {
    e.preventDefault(); if (!profile?.orgId) return; setSavingQualForm(true)
    try { await callApi({ action: 'save_qualification_form', form: qualForm }); toast.success('Formulario guardado') }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Error') } finally { setSavingQualForm(false) }
  }

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newWebhook.url || newWebhook.events.length === 0) { toast.error('Completa la URL y selecciona eventos'); return }
    setSavingWebhook(true)
    try {
      const id = await createWebhook(profile.orgId, { url: newWebhook.url, events: newWebhook.events, active: true })
      setWebhooks(prev => [...prev, { id, ...newWebhook, orgId: profile.orgId!, active: true, createdAt: new Date() }])
      setNewWebhook({ url: '', events: [] }); toast.success('Webhook añadido')
    } catch { toast.error('Error al guardar') } finally { setSavingWebhook(false) }
  }

  const handleSaveCaptureForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newFormName.trim() || newFormFields.length === 0) { toast.error('Añade nombre y al menos un campo'); return }
    setSavingForm(true)
    try {
      const id = await createCaptureForm(profile.orgId, { name: newFormName, fields: newFormFields.filter(f => f.label.trim()), defaultStatus: 'lead', confirmationMessage: newFormConfirmation, active: true })
      setCaptureForms(prev => [...prev, { id, name: newFormName, fields: newFormFields, defaultStatus: 'lead', confirmationMessage: newFormConfirmation, active: true, createdAt: new Date(), submissionCount: 0, orgId: profile.orgId! }])
      setNewFormName(''); setNewFormFields([]); setNewFormConfirmation('¡Gracias! Nos pondremos en contacto pronto.'); setShowFormBuilder(false)
      toast.success('Formulario creado')
    } catch { toast.error('Error al crear formulario') } finally { setSavingForm(false) }
  }

  const handleFixPhones = async () => {
    if (!profile?.orgId) return; setCleaningPhones(true)
    try {
      const res = await fetch('/api/admin/fix-phone-data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: profile.orgId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.fixed} registros corregidos`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setCleaningPhones(false) }
  }

  const handleCleanFakes = async () => {
    if (!profile?.orgId) return; setCleaningFakes(true)
    try {
      const res = await fetch('/api/admin/cleanup-fake-clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: profile.orgId }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.deleted} contactos eliminados`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Error') } finally { setCleaningFakes(false) }
  }

  const isOwner = profile?.role === 'owner' || profile?.role === 'super_admin'

  if (loading) return <Spinner />

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configuración" subtitle="Ajustes de tu organización" />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F4F5F7] dark:bg-[#1A2540]/60 p-1 rounded-md overflow-x-auto">
        {TABS.filter(t => t.id !== 'avanzado' || isOwner).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-[#0F1829] text-[#0C1224] dark:text-[#E8ECF4] shadow-sm'
                : 'text-[#68748D] dark:text-[#9BA5B7] hover:text-[#0C1224] dark:hover:text-slate-200'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ─────────────────────────────────────── */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <form onSubmit={handleSave} className="space-y-4">
            <Card className="space-y-4">
              <SectionHeader icon={Building2} title="Información de la organización" />
              <div>
                <label className={labelClass}>ID de organización</label>
                <div className="flex items-center gap-2">
                  <input readOnly value={profile?.orgId || ''} className={inputClass + ' font-mono text-xs text-[#68748D] cursor-default select-all'} />
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(profile?.orgId || ''); toast.success('ID copiado') }}
                    className="flex-shrink-0 p-2.5 bg-[#F4F5F7] dark:bg-[#1A2540] hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] rounded-md transition-colors"
                    title="Copiar ID"
                  >
                    <Copy size={14} className="text-[#68748D]" />
                  </button>
                </div>
                <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] mt-1">Úsalo en musaweb como NEXT_PUBLIC_CRM_ORG_ID</p>
              </div>
              <div>
                <label className={labelClass}>Nombre de la organización</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass} placeholder="Mi empresa" />
              </div>
              <div>
                <label className={labelClass}>Industria / Sector</label>
                <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className={inputClass} placeholder="Ej: Agencia de vehículos, Inmobiliaria..." />
              </div>
              <div>
                <label className={labelClass}>URL del sitio web vinculado</label>
                <input
                  value={form.websiteUrl}
                  onChange={e => setForm(f => ({ ...f, websiteUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="https://musaweb.up.railway.app"
                />
                <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] mt-1">Solo esta URL podrá enviar citas al CRM</p>
              </div>
              <div>
                <label className={labelClass}>Número de WhatsApp del negocio</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] text-sm">+</span>
                  <input value={form.whatsappNumber} onChange={e => setForm(f => ({ ...f, whatsappNumber: e.target.value.replace(/\D/g, '') }))} className={inputClass + ' pl-6'} placeholder="5491112345678" />
                </div>
                <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] mt-1">Código de país + número, sin espacios ni +</p>
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow-lg transition-colors">
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </Card>
          </form>

          {/* Horario de Atención */}
          <Card className="space-y-4">
            <SectionHeader icon={Clock} title="Horario de atención" desc="Define los días y horas en que se aceptan citas desde tu web" />
            <div>
              <label className={labelClass}>Días disponibles</label>
              <div className="flex flex-wrap gap-2">
                {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d, i) => {
                  const active = businessHours.days.includes(i)
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setBusinessHours(prev => ({
                        ...prev,
                        days: active ? prev.days.filter(x => x !== i) : [...prev.days, i].sort(),
                      }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        active
                          ? 'bg-[#0C1224] text-white border-[#0D7A65]'
                          : 'bg-white dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] border-[#E3E6EC] dark:border-[#1A2540] hover:border-[#0D7A65]'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Hora apertura</label>
                <input
                  type="time"
                  value={businessHours.openTime}
                  onChange={e => setBusinessHours(prev => ({ ...prev, openTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Hora cierre</label>
                <input
                  type="time"
                  value={businessHours.closeTime}
                  onChange={e => setBusinessHours(prev => ({ ...prev, closeTime: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Duración de cada cita</label>
              <select
                value={businessHours.slotMinutes}
                onChange={e => setBusinessHours(prev => ({ ...prev, slotMinutes: Number(e.target.value) }))}
                className={inputClass}
              >
                <option value={30}>30 minutos</option>
                <option value={60}>1 hora</option>
                <option value={90}>1.5 horas</option>
                <option value={120}>2 horas</option>
              </select>
            </div>
            <button
              type="button"
              onClick={handleSaveBusinessHours}
              disabled={savingBusinessHours}
              className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow-lg transition-colors"
            >
              {savingBusinessHours ? 'Guardando...' : 'Guardar horario'}
            </button>
          </Card>

          {/* Accesos directos — Equipo y Categorías */}
          <Card className="space-y-4">
            <SectionHeader icon={Building2} title="Gestión del equipo y categorías" desc="Accesos rápidos a las secciones de administración" />
            <div className="grid grid-cols-2 gap-3">
              <a
                href="/dashboard/team"
                className="flex items-center gap-3 p-4 bg-[#F4F5F7] dark:bg-[#0D7A65]/10 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-[#0D7A65]/10 dark:hover:bg-blue-900/40 transition-colors group"
              >
                <div className="p-2 bg-[#0C1224] rounded-lg">
                  <Users size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Equipo</p>
                  <p className="text-xs text-[#68748D] dark:text-[#9BA5B7]">Usuarios y roles</p>
                </div>
                <ExternalLink size={14} className="text-[#9BA5B7] ml-auto group-hover:text-[#0D7A65] transition-colors" />
              </a>
              <a
                href="/dashboard/categories"
                className="flex items-center gap-3 p-4 bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors group"
              >
                <div className="p-2 bg-slate-600 rounded-lg">
                  <Tag size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Categorías</p>
                  <p className="text-xs text-[#68748D] dark:text-[#9BA5B7]">Etiquetas de clientes</p>
                </div>
                <ExternalLink size={14} className="text-[#9BA5B7] ml-auto group-hover:text-[#68748D] transition-colors" />
              </a>
            </div>
          </Card>
        </div>
      )}

      {/* ── CONEXIONES ──────────────────────────────────── */}
      {activeTab === 'conexiones' && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <SectionHeader icon={MessageCircle} title="WhatsApp" desc="Escanea el QR con tu teléfono para vincular tu número" />
            <BaileysQR orgId={profile?.orgId || ''} />
          </Card>
          <Card className="space-y-4">
            <SectionHeader icon={Instagram} title="Instagram" desc="Conecta tu cuenta para recibir mensajes directos" />
            <InstagramConnect />
          </Card>
        </div>
      )}

      {/* ── PIPELINE ────────────────────────────────────── */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          {/* Etapas */}
          <Card className="space-y-4">
            <SectionHeader icon={GitBranch} title="Etapas del pipeline" />
            <div className="space-y-1.5">
              {stages.map(stage => (
                <div key={stage.id} className="flex items-center justify-between py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-sm text-[#0C1224] dark:text-[#E8ECF4]">{stage.name}</span>
                  </div>
                  <button onClick={() => handleDeleteStage(stage.id)} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddStage} className="flex gap-2 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
              <input value={newStage.name} onChange={e => setNewStage(s => ({ ...s, name: e.target.value }))} className="flex-1 bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-3 py-2 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors" placeholder="Nueva etapa" />
              <input type="color" value={newStage.color} onChange={e => setNewStage(s => ({ ...s, color: e.target.value }))} className="w-10 h-10 rounded-md border border-[#E3E6EC] dark:border-[#1A2540] cursor-pointer p-1 bg-[#F4F5F7] dark:bg-[#1A2540] flex-shrink-0" />
              <button type="submit" disabled={savingStage || !newStage.name} className="px-4 py-2 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition-colors flex-shrink-0">
                <Plus size={15} />
              </button>
            </form>
          </Card>

          {/* Estados de clientes */}
          <Card className="space-y-4">
            <SectionHeader icon={Tag} title="Estados de clientes" desc='Personaliza los estados del campo "Estado" de cada cliente' />
            <div className="space-y-1.5">
              {clientStatuses.map(s => (
                <div key={s.value} className="flex items-center gap-2 py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                  <span className="text-xs font-mono text-[#9BA5B7] w-24 flex-shrink-0 truncate">{s.value}</span>
                  <input defaultValue={s.label} onBlur={e => { if (e.target.value.trim() !== s.label) handleRenameStatus(s.value, e.target.value) }}
                    className="flex-1 bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg px-3 py-1.5 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors" />
                  <button onClick={() => handleDeleteStatus(s.value)} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddStatus} className="flex gap-2 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
              <input value={newStatus.label} onChange={e => setNewStatus(s => ({ ...s, label: e.target.value }))} className="flex-1 bg-[#F4F5F7] dark:bg-[#1A2540] border border-[#E3E6EC] dark:border-[#1A2540] rounded-md px-3 py-2 text-sm text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none focus:border-[#0D7A65] transition-colors" placeholder='Nuevo estado (ej: "En proceso")' />
              <button type="submit" disabled={savingStatuses || !newStatus.label.trim()} className="px-4 py-2 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition-colors flex-shrink-0">
                <Plus size={15} />
              </button>
            </form>
          </Card>
        </div>
      )}

      {/* ── MENSAJES ────────────────────────────────────── */}
      {activeTab === 'mensajes' && (
        <div className="space-y-4">
          {/* Plantillas */}
          <Card className="space-y-4">
            <SectionHeader icon={MessageCircle} title="Plantillas de WhatsApp" desc="Respuestas rápidas para el chat" />
            {templates.length > 0 && (
              <div className="space-y-1.5">
                {templates.map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-3 py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">{t.name}</p>
                      <p className="text-xs text-[#9BA5B7] mt-0.5 line-clamp-1">{t.body}</p>
                    </div>
                    <button onClick={() => handleDeleteTemplate(t.id)} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleSaveTemplate} className="space-y-2 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
              <input value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))} className={inputClass} placeholder='Nombre (ej: "Bienvenida")' />
              <textarea value={newTemplate.body} onChange={e => setNewTemplate(t => ({ ...t, body: e.target.value }))} rows={2} className={`${inputClass} resize-none`} placeholder="Texto del mensaje..." />
              <button type="submit" disabled={savingTemplate || !newTemplate.name || !newTemplate.body} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition-colors">
                <Plus size={14} /> Guardar plantilla
              </button>
            </form>
          </Card>

          {/* Auto-reply */}
          <form onSubmit={handleSaveAutoReply}>
            <Card className="space-y-4">
              <SectionHeader icon={Bot} title="Respuesta automática" desc="Se envía al recibir un mensaje nuevo" />
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle on={autoReply.enabled} onToggle={() => setAutoReply(a => ({ ...a, enabled: !a.enabled }))} />
                <span className="text-sm text-[#0C1224] dark:text-[#9BA5B7]">{autoReply.enabled ? 'Activada' : 'Desactivada'}</span>
              </label>
              {autoReply.enabled && (
                <textarea value={autoReply.message} onChange={e => setAutoReply(a => ({ ...a, message: e.target.value }))} rows={3} className={`${inputClass} resize-none`} placeholder="Ej: Gracias por contactarnos. En breve te atendemos..." />
              )}
              <button type="submit" disabled={savingAutoReply} className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow transition-colors">
                {savingAutoReply ? 'Guardando...' : 'Guardar'}
              </button>
            </Card>
          </form>

          {/* Mensaje de seguimiento */}
          <form onSubmit={handleSaveWindowMsg}>
            <Card className="space-y-4">
              <SectionHeader icon={Bot} title="Mensaje de seguimiento automático" desc="Se envía X horas después del primer mensaje (ventana 24h)" />
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle on={windowMsg.enabled} onToggle={() => setWindowMsg(w => ({ ...w, enabled: !w.enabled }))} />
                <span className="text-sm text-[#0C1224] dark:text-[#9BA5B7]">{windowMsg.enabled ? 'Activado' : 'Desactivado'}</span>
              </label>
              {windowMsg.enabled && (
                <>
                  <div>
                    <label className={labelClass}>Horas de espera</label>
                    <div className="flex items-center gap-3">
                      <input type="number" min={1} max={23} value={windowMsg.delayHours} onChange={e => setWindowMsg(w => ({ ...w, delayHours: Math.min(23, Math.max(1, Number(e.target.value))) }))} className={`${inputClass} w-24`} />
                      <span className="text-sm text-[#68748D] dark:text-[#9BA5B7]">horas (máx. 23)</span>
                    </div>
                  </div>
                  <textarea value={windowMsg.message} onChange={e => setWindowMsg(w => ({ ...w, message: e.target.value }))} rows={3} className={`${inputClass} resize-none`} placeholder="Ej: ¡Hola! ¿Tienes alguna pregunta?" />
                </>
              )}
              <button type="submit" disabled={savingWindowMsg} className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow transition-colors">
                {savingWindowMsg ? 'Guardando...' : 'Guardar'}
              </button>
            </Card>
          </form>

          {/* Formulario de calificación */}
          <form onSubmit={handleSaveQualForm}>
            <Card className="space-y-4">
              <SectionHeader icon={ClipboardList} title="Formulario de calificación" desc="Se envía por WhatsApp cuando un nuevo contacto escribe" />
              <label className="flex items-center gap-3 cursor-pointer">
                <Toggle on={qualForm.enabled} onToggle={() => setQualForm(f => ({ ...f, enabled: !f.enabled }))} />
                <span className="text-sm text-[#0C1224] dark:text-[#9BA5B7]">{qualForm.enabled ? 'Activado' : 'Desactivado'}</span>
              </label>
              {qualForm.questions.length > 0 && (
                <div className="space-y-1.5">
                  {qualForm.questions.map((q, i) => (
                    <div key={q.id} className="flex items-center gap-3 py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                      <GripVertical size={14} className="text-[#9BA5B7] dark:text-[#68748D] flex-shrink-0" />
                      <span className="text-xs text-[#9BA5B7] font-mono w-4 flex-shrink-0">{i + 1}.</span>
                      <p className="flex-1 text-sm text-[#0C1224] dark:text-[#E8ECF4] truncate">{q.text}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${questionTypeBadge[q.type]}`}>{questionTypeLabel[q.type]}</span>
                      {q.autoTag && <Tag size={12} className="text-orange-500 flex-shrink-0" />}
                      <button type="button" onClick={() => setQualForm(f => ({ ...f, questions: f.questions.filter(x => x.id !== q.id).map((x, idx) => ({ ...x, order: idx })) }))} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                <input value={newQuestion.text} onChange={e => setNewQuestion(q => ({ ...q, text: e.target.value }))} placeholder="Nueva pregunta..." className={inputClass} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddQuestion(e) } }} />
                <div className="flex gap-2">
                  <select value={newQuestion.type} onChange={e => setNewQuestion(q => ({ ...q, type: e.target.value as QualificationQuestionType }))} className={`${inputClass} flex-1`}>
                    <option value="text">Texto libre</option>
                    <option value="phone">Teléfono</option>
                    <option value="yes_no">Sí / No</option>
                    <option value="number">Número</option>
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-[#68748D] dark:text-[#9BA5B7] whitespace-nowrap cursor-pointer">
                    <input type="checkbox" checked={newQuestion.autoTag} onChange={e => setNewQuestion(q => ({ ...q, autoTag: e.target.checked }))} className="w-4 h-4 rounded border-[#E3E6EC]" />
                    <Tag size={12} className="text-orange-500" /> Etiqueta
                  </label>
                </div>
                <button type="button" onClick={handleAddQuestion} disabled={!newQuestion.text.trim()} className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-[#E3E6EC] dark:border-slate-600 text-[#68748D] dark:text-[#9BA5B7] text-sm rounded-md hover:border-[#0D7A65] hover:text-[#0D7A65] disabled:opacity-40 transition-colors">
                  <Plus size={14} /> Añadir pregunta
                </button>
              </div>
              <div>
                <label className={labelClass}>Mensaje al finalizar</label>
                <textarea value={qualForm.completionMessage} onChange={e => setQualForm(f => ({ ...f, completionMessage: e.target.value }))} rows={2} className={`${inputClass} resize-none`} placeholder="Ej: ¡Gracias! En breve te contactamos." />
              </div>
              <button type="submit" disabled={savingQualForm} className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow transition-colors">
                {savingQualForm ? 'Guardando...' : 'Guardar formulario'}
              </button>
            </Card>
          </form>
        </div>
      )}

      {/* ── AVANZADO ─────────────────────────────────────── */}
      {activeTab === 'avanzado' && isOwner && (
        <div className="space-y-4">
          {/* Webhooks */}
          <Card className="space-y-4">
            <SectionHeader icon={WebhookIcon} title="Webhooks salientes" desc="Notifica sistemas externos cuando ocurren eventos" />
            {webhooks.length > 0 && (
              <div className="space-y-1.5">
                {webhooks.map(wh => (
                  <div key={wh.id} className="flex items-start gap-3 py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-mono text-[#0C1224] dark:text-[#9BA5B7] truncate">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wh.events.map(ev => <span key={ev} className="text-xs bg-[#E3E6EC] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] px-1.5 py-0.5 rounded">{ev}</span>)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Toggle on={wh.active} onToggle={() => { if (profile?.orgId) { updateWebhook(profile.orgId, wh.id, { active: !wh.active }); setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: !w.active } : w)) } }} />
                      <button onClick={() => { if (profile?.orgId) { deleteWebhook(profile.orgId, wh.id); setWebhooks(prev => prev.filter(w => w.id !== wh.id)) } }} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={handleAddWebhook} className="space-y-3 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
              <input value={newWebhook.url} onChange={e => setNewWebhook(w => ({ ...w, url: e.target.value }))} className={inputClass} placeholder="https://mi-sistema.com/webhook" />
              <div className="flex flex-wrap gap-3">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newWebhook.events.includes(ev.value)} onChange={e => setNewWebhook(w => ({ ...w, events: e.target.checked ? [...w.events, ev.value] : w.events.filter(x => x !== ev.value) }))} className="w-3.5 h-3.5 rounded border-[#E3E6EC]" />
                    <span className="text-xs text-[#0C1224] dark:text-[#9BA5B7]">{ev.label}</span>
                  </label>
                ))}
              </div>
              <button type="submit" disabled={savingWebhook || !newWebhook.url} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md shadow transition-colors">
                <Plus size={14} /> Añadir webhook
              </button>
            </form>
          </Card>

          {/* Formularios de captura */}
          {(profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.role === 'manager') && (
            <Card className="space-y-4">
              <SectionHeader icon={FormInput} title="Formularios de captura" desc="Formularios públicos para capturar leads automáticamente" />
              {captureForms.length > 0 && (
                <div className="space-y-1.5">
                  {captureForms.map(f => {
                    const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/form/${profile?.orgId}/${f.id}` : ''
                    return (
                      <div key={f.id} className="flex items-center gap-3 py-2 px-3 bg-[#F4F5F7] dark:bg-[#1A2540] rounded-md">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">{f.name}</p>
                          <p className="text-xs text-[#9BA5B7] mt-0.5">{f.fields.length} campo(s) · {f.submissionCount} envíos</p>
                        </div>
                        <a href={formUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 text-[#9BA5B7] hover:text-[#0C1224] dark:hover:text-slate-200 hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] rounded-lg transition-colors">
                          <ExternalLink size={13} />
                        </a>
                        <button onClick={() => { navigator.clipboard.writeText(formUrl); toast.success('URL copiada') }} className="p-1.5 text-[#9BA5B7] hover:text-[#0C1224] dark:hover:text-slate-200 hover:bg-[#E3E6EC] dark:hover:bg-[#1A2540] rounded-lg transition-colors">
                          <Copy size={13} />
                        </button>
                        <button onClick={() => { if (profile?.orgId) { deleteCaptureForm(profile.orgId, f.id); setCaptureForms(prev => prev.filter(x => x.id !== f.id)) } }} className="p-1.5 text-[#9BA5B7] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {!showFormBuilder ? (
                <button onClick={() => setShowFormBuilder(true)} className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-[#E3E6EC] dark:border-slate-600 text-[#68748D] dark:text-[#9BA5B7] text-sm rounded-md hover:border-[#0D7A65] hover:text-[#0D7A65] transition-colors">
                  <Plus size={14} /> Crear formulario
                </button>
              ) : (
                <form onSubmit={handleSaveCaptureForm} className="space-y-3 pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                  <input value={newFormName} onChange={e => setNewFormName(e.target.value)} className={inputClass} placeholder='Nombre del formulario (ej: "Contacto web")' />
                  <div className="space-y-2">
                    {newFormFields.map(field => (
                      <div key={field.id} className="flex items-center gap-2 bg-[#F4F5F7] dark:bg-[#1A2540] p-2 rounded-md">
                        <input value={field.label} onChange={e => setNewFormFields(prev => prev.map(f => f.id === field.id ? { ...f, label: e.target.value } : f))} className="flex-1 bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg px-2 py-1.5 text-xs text-[#0C1224] dark:text-[#E8ECF4] focus:outline-none" placeholder="Etiqueta" />
                        <select value={field.type} onChange={e => setNewFormFields(prev => prev.map(f => f.id === field.id ? { ...f, type: e.target.value as CaptureFormField['type'] } : f))} className="bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg px-2 py-1.5 text-xs text-[#0C1224] dark:text-[#9BA5B7] focus:outline-none">
                          <option value="text">Texto</option>
                          <option value="email">Email</option>
                          <option value="phone">Teléfono</option>
                          <option value="textarea">Área</option>
                        </select>
                        <label className="flex items-center gap-1 text-xs text-[#68748D] whitespace-nowrap">
                          <input type="checkbox" checked={field.required} onChange={e => setNewFormFields(prev => prev.map(f => f.id === field.id ? { ...f, required: e.target.checked } : f))} className="w-3 h-3" /> Req.
                        </label>
                        <button type="button" onClick={() => setNewFormFields(prev => prev.filter(f => f.id !== field.id))} className="p-1 text-[#9BA5B7] hover:text-red-500 rounded">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setNewFormFields(prev => [...prev, { id: `f_${Date.now()}`, label: '', type: 'text', required: false }])} className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-[#E3E6EC] dark:border-slate-600 rounded-md text-sm text-[#68748D] hover:border-[#0D7A65] hover:text-[#0D7A65] transition-colors">
                    <Plus size={13} /> Añadir campo
                  </button>
                  <input value={newFormConfirmation} onChange={e => setNewFormConfirmation(e.target.value)} className={inputClass} placeholder="Mensaje de confirmación al enviar" />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowFormBuilder(false)} className="flex-1 px-3 py-2.5 border border-[#E3E6EC] dark:border-[#1A2540] text-sm text-[#68748D] dark:text-[#9BA5B7] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors">Cancelar</button>
                    <button type="submit" disabled={savingForm} className="flex-1 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md transition-colors py-2.5">{savingForm ? 'Guardando...' : 'Crear formulario'}</button>
                  </div>
                </form>
              )}
            </Card>
          )}

          {/* Facturación */}
          <Card className="space-y-4">
            <SectionHeader icon={CreditCard} title="Planes y facturación" desc="Gestiona tu suscripción" />
            <div className="space-y-2">
              {([
                { plan: 'trial' as const, name: 'Trial', price: 'Gratis', features: ['1 usuario', '100 clientes', 'WhatsApp básico'] },
                { plan: 'basic' as const, name: 'Básico', price: '$29/mes', features: ['5 usuarios', '1,000 clientes', 'WhatsApp + Instagram', 'Reportes'] },
                { plan: 'pro' as const, name: 'Pro', price: '$79/mes', features: ['Usuarios ilimitados', 'Clientes ilimitados', 'Todos los canales', 'Webhooks', 'Formularios'] },
              ] as const).map(tier => {
                const current = org?.plan === tier.plan
                return (
                  <div key={tier.plan} className={`p-4 rounded-md border-2 transition-all ${current ? 'border-[#0D7A65] bg-[#F4F5F7] dark:bg-blue-900/10' : 'border-[#E3E6EC] dark:border-[#1A2540]'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#0C1224] dark:text-[#E8ECF4]">{tier.name}</span>
                        {current && <span className="text-xs bg-[#0C1224] text-white px-2 py-0.5 rounded-full">Actual</span>}
                      </div>
                      <span className="font-bold text-[#0C1224] dark:text-[#9BA5B7] text-sm">{tier.price}</span>
                    </div>
                    <ul className="space-y-0.5 mb-3">
                      {tier.features.map(f => (
                        <li key={f} className="text-xs text-[#68748D] dark:text-[#9BA5B7] flex items-center gap-1.5">
                          <CheckCircle size={11} className="text-emerald-500 flex-shrink-0" /> {f}
                        </li>
                      ))}
                    </ul>
                    {!current && (
                      <button onClick={async () => {
                        try {
                          const res = await fetch('/api/billing/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orgId: profile?.orgId, plan: tier.plan }) })
                          const data = await res.json()
                          if (data.url) window.location.href = data.url
                          else toast.error(data.error || 'Error al iniciar pago')
                        } catch { toast.error('Error de conexión') }
                      }} className="w-full bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-[#F4F5F7] text-white dark:text-[#0C1224] text-sm font-bold py-2 rounded-lg transition-colors">
                        Cambiar a {tier.name}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Mantenimiento */}
          {profile?.role === 'owner' && (
            <Card className="space-y-4">
              <SectionHeader icon={Wrench} title="Mantenimiento de datos" desc="Herramientas para limpiar datos incorrectos" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Corregir teléfonos inválidos</p>
                    <p className="text-xs text-[#68748D] dark:text-[#9BA5B7]">Elimina campos con texto en lugar de números</p>
                  </div>
                  <button onClick={handleFixPhones} disabled={cleaningPhones} className="flex-shrink-0 px-4 py-2 bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white text-sm font-bold rounded-md transition-colors">
                    {cleaningPhones ? 'Procesando...' : 'Ejecutar'}
                  </button>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
                  <div>
                    <p className="text-sm font-bold text-[#0C1224] dark:text-[#E8ECF4]">Eliminar contactos falsos</p>
                    <p className="text-xs text-[#68748D] dark:text-[#9BA5B7]">Elimina clientes de broadcasts o JIDs inválidos</p>
                  </div>
                  <button onClick={handleCleanFakes} disabled={cleaningFakes} className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-md transition-colors">
                    {cleaningFakes ? 'Procesando...' : 'Limpiar'}
                  </button>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
