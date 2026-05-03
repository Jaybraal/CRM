'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, getWhatsAppTemplates, getWebhooks, createWebhook, updateWebhook, deleteWebhook, getCaptureForms, createCaptureForm, deleteCaptureForm } from '@/lib/firestore'
import type { Organization, WhatsAppTemplate, PipelineStage, QualificationQuestion, QualificationQuestionType, ClientStatus, Webhook, WebhookEvent, CaptureForm, CaptureFormField } from '@/types'
import { DEFAULT_CLIENT_STATUSES } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import InstagramConnect from '@/components/settings/InstagramConnect'
import { Building2, MessageCircle, Instagram, Copy, CheckCircle, Plus, Trash2, GitBranch, Bot, Wrench, ClipboardList, GripVertical, Tag, Webhook as WebhookIcon, CreditCard, FormInput, ExternalLink, Globe } from 'lucide-react'

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'
const cardClass = 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', industry: '', whatsappNumber: '' })
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
  const [qualForm, setQualForm] = useState<{
    enabled: boolean
    questions: QualificationQuestion[]
    completionMessage: string
  }>({ enabled: false, questions: [], completionMessage: '' })
  const [newQuestion, setNewQuestion] = useState({ text: '', type: 'text' as QualificationQuestionType, autoTag: false })
  const [savingQualForm, setSavingQualForm] = useState(false)

  const DEFAULT_STAGES: PipelineStage[] = [
    { id: 'new', name: 'Nuevo', order: 0, color: '#6b7280' },
    { id: 'contacted', name: 'Contactado', order: 1, color: '#3b82f6' },
    { id: 'negotiation', name: 'Negociación', order: 2, color: '#f59e0b' },
    { id: 'closed_won', name: 'Ganado', order: 3, color: '#10b981' },
    { id: 'closed_lost', name: 'Perdido', order: 4, color: '#ef4444' },
  ]

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/whatsapp/webhook`
    : '/api/whatsapp/webhook'

  useEffect(() => {
    if (!profile) return
    if (!profile.orgId) { setLoading(false); return }
    Promise.all([
      getOrganization(profile.orgId),
      getWhatsAppTemplates(profile.orgId),
      getWebhooks(profile.orgId),
      getCaptureForms(profile.orgId),
    ]).then(([o, tmpl, wh, forms]) => {
      setWebhooks(wh)
      setCaptureForms(forms)
      if (o) {
        setOrg(o)
        setForm({ name: o.name, industry: o.settings.industry, whatsappNumber: o.settings.whatsappNumber || '' })
        setStages(o.settings.pipelineStages || DEFAULT_STAGES)
        setClientStatuses(o.settings.clientStatuses || DEFAULT_CLIENT_STATUSES)
        setAutoReply({
          enabled: o.settings.autoReply?.enabled || false,
          message: o.settings.autoReply?.message || '',
        })
        setWindowMsg({
          enabled: o.settings.windowMessage?.enabled || false,
          message: o.settings.windowMessage?.message || '',
          delayHours: o.settings.windowMessage?.delayHours ?? 23,
        })
        setQualForm({
          enabled: o.settings.qualificationForm?.enabled || false,
          questions: o.settings.qualificationForm?.questions || [],
          completionMessage: o.settings.qualificationForm?.completionMessage || '',
        })
      }
      setTemplates(tmpl)
    })
    .catch(e => console.error('Error cargando configuración:', e))
    .finally(() => setLoading(false))
  }, [profile])

  const callApi = async (body: Record<string, unknown>) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: profile?.orgId, ...body }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error desconocido')
    return data
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSaving(true)
    try {
      await callApi({ action: 'save_org', name: form.name, industry: form.industry, whatsappNumber: form.whatsappNumber.trim() })
      toast.success('Configuración guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newTemplate.name || !newTemplate.body) return
    setSavingTemplate(true)
    try {
      const data = await callApi({ action: 'save_template', name: newTemplate.name, body: newTemplate.body })
      setTemplates(prev => [...prev, { id: data.id, name: newTemplate.name, body: newTemplate.body, createdAt: new Date() }])
      setNewTemplate({ name: '', body: '' })
      toast.success('Plantilla guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar', { duration: 6000 })
    } finally { setSavingTemplate(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!profile?.orgId) return
    try {
      await callApi({ action: 'delete_template', templateId: id })
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Plantilla eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newStage.name) return
    setSavingStage(true)
    try {
      const updated: PipelineStage[] = [
        ...stages,
        { id: `stage_${Date.now()}`, name: newStage.name, color: newStage.color, order: stages.length },
      ]
      await callApi({ action: 'save_pipeline_stage', stages: updated })
      setStages(updated)
      setNewStage({ name: '', color: '#6b7280' })
      toast.success('Etapa añadida')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSavingStage(false) }
  }

  const handleDeleteStage = async (id: string) => {
    if (!profile?.orgId) return
    const updated = stages.filter(s => s.id !== id)
    try {
      await callApi({ action: 'save_pipeline_stage', stages: updated })
      setStages(updated)
      toast.success('Etapa eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const handleAddStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newStatus.label.trim()) return
    const value = newStatus.value.trim() || newStatus.label.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (clientStatuses.some(s => s.value === value)) { toast.error('Ya existe un estado con ese nombre'); return }
    setSavingStatuses(true)
    try {
      const updated = [...clientStatuses, { value, label: newStatus.label.trim() }]
      await callApi({ action: 'save_client_statuses', statuses: updated })
      setClientStatuses(updated)
      setNewStatus({ value: '', label: '' })
      toast.success('Estado añadido')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSavingStatuses(false) }
  }

  const handleDeleteStatus = async (value: string) => {
    if (!profile?.orgId) return
    if (clientStatuses.length <= 1) { toast.error('Debe haber al menos un estado'); return }
    const updated = clientStatuses.filter(s => s.value !== value)
    try {
      await callApi({ action: 'save_client_statuses', statuses: updated })
      setClientStatuses(updated)
      toast.success('Estado eliminado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const handleRenameStatus = async (value: string, newLabel: string) => {
    if (!profile?.orgId || !newLabel.trim()) return
    const updated = clientStatuses.map(s => s.value === value ? { ...s, label: newLabel.trim() } : s)
    try {
      await callApi({ action: 'save_client_statuses', statuses: updated })
      setClientStatuses(updated)
      toast.success('Estado actualizado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al actualizar')
    }
  }

  const handleSaveWindowMsg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSavingWindowMsg(true)
    try {
      await callApi({ action: 'save_window_message', enabled: windowMsg.enabled, message: windowMsg.message, delayHours: windowMsg.delayHours })
      toast.success('Mensaje de ventana guardado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar', { duration: 6000 })
    } finally { setSavingWindowMsg(false) }
  }

  const handleSaveAutoReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSavingAutoReply(true)
    try {
      await callApi({ action: 'save_autoreply', enabled: autoReply.enabled, message: autoReply.message })
      toast.success('Respuesta automática guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar', { duration: 6000 })
    } finally { setSavingAutoReply(false) }
  }

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newQuestion.text.trim()) return
    const q: QualificationQuestion = {
      id: `q_${Date.now()}`,
      text: newQuestion.text.trim(),
      type: newQuestion.type,
      order: qualForm.questions.length,
      ...(newQuestion.autoTag ? { autoTag: true } : {}),
    }
    setQualForm(f => ({ ...f, questions: [...f.questions, q] }))
    setNewQuestion({ text: '', type: 'text', autoTag: false })
  }

  const handleDeleteQuestion = (id: string) => {
    setQualForm(f => ({
      ...f,
      questions: f.questions.filter(q => q.id !== id).map((q, i) => ({ ...q, order: i })),
    }))
  }

  const handleSaveQualForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSavingQualForm(true)
    try {
      await callApi({ action: 'save_qualification_form', form: qualForm })
      toast.success('Formulario de calificación guardado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar')
    } finally { setSavingQualForm(false) }
  }

  const questionTypeLabel: Record<QualificationQuestionType, string> = {
    text: 'Texto libre',
    phone: 'Teléfono',
    yes_no: 'Sí / No',
    number: 'Número',
  }

  const questionTypeBadge: Record<QualificationQuestionType, string> = {
    text: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    phone: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    yes_no: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    number: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
  }

  // Webhooks state
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [newWebhook, setNewWebhook] = useState({ url: '', events: [] as WebhookEvent[] })
  const [savingWebhook, setSavingWebhook] = useState(false)

  // Capture forms state
  const [captureForms, setCaptureForms] = useState<CaptureForm[]>([])
  const [showFormBuilder, setShowFormBuilder] = useState(false)
  const [newFormName, setNewFormName] = useState('')
  const [newFormFields, setNewFormFields] = useState<CaptureFormField[]>([])
  const [newFormConfirmation, setNewFormConfirmation] = useState('¡Gracias! Nos pondremos en contacto pronto.')
  const [savingForm, setSavingForm] = useState(false)

  const [cleaningPhones, setCleaningPhones] = useState(false)
  const [cleaningFakes, setCleaningFakes] = useState(false)

  // Webhook handlers
  const WEBHOOK_EVENTS: { value: WebhookEvent; label: string }[] = [
    { value: 'new_client', label: 'Nuevo cliente' },
    { value: 'new_message', label: 'Nuevo mensaje' },
    { value: 'deal_created', label: 'Deal creado' },
    { value: 'deal_closed', label: 'Deal cerrado' },
    { value: 'task_created', label: 'Tarea creada' },
  ]

  const handleAddWebhook = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newWebhook.url || newWebhook.events.length === 0) {
      toast.error('Completa la URL y selecciona al menos un evento'); return
    }
    setSavingWebhook(true)
    try {
      const id = await createWebhook(profile.orgId, { url: newWebhook.url, events: newWebhook.events, active: true })
      setWebhooks(prev => [...prev, { id, ...newWebhook, orgId: profile.orgId!, active: true, createdAt: new Date() }])
      setNewWebhook({ url: '', events: [] })
      toast.success('Webhook añadido')
    } catch { toast.error('Error al guardar webhook') }
    finally { setSavingWebhook(false) }
  }

  const handleToggleWebhook = async (wh: Webhook) => {
    if (!profile?.orgId) return
    await updateWebhook(profile.orgId, wh.id, { active: !wh.active })
    setWebhooks(prev => prev.map(w => w.id === wh.id ? { ...w, active: !w.active } : w))
  }

  const handleDeleteWebhook = async (id: string) => {
    if (!profile?.orgId) return
    await deleteWebhook(profile.orgId, id)
    setWebhooks(prev => prev.filter(w => w.id !== id))
    toast.success('Webhook eliminado')
  }

  // Capture form handlers
  const addFormField = () => {
    const field: CaptureFormField = { id: `f_${Date.now()}`, label: '', type: 'text', required: false }
    setNewFormFields(prev => [...prev, field])
  }

  const updateFormField = (id: string, data: Partial<CaptureFormField>) => {
    setNewFormFields(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }

  const handleSaveCaptureForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !newFormName.trim() || newFormFields.length === 0) {
      toast.error('Añade un nombre y al menos un campo'); return
    }
    setSavingForm(true)
    try {
      const id = await createCaptureForm(profile.orgId, {
        name: newFormName,
        fields: newFormFields.filter(f => f.label.trim()),
        defaultStatus: 'lead',
        confirmationMessage: newFormConfirmation,
        active: true,
      })
      setCaptureForms(prev => [...prev, { id, name: newFormName, fields: newFormFields, defaultStatus: 'lead', confirmationMessage: newFormConfirmation, active: true, createdAt: new Date(), submissionCount: 0, orgId: profile.orgId! }])
      setNewFormName(''); setNewFormFields([]); setNewFormConfirmation('¡Gracias! Nos pondremos en contacto pronto.')
      setShowFormBuilder(false)
      toast.success('Formulario creado')
    } catch { toast.error('Error al crear formulario') }
    finally { setSavingForm(false) }
  }

  const handleDeleteForm = async (id: string) => {
    if (!profile?.orgId) return
    await deleteCaptureForm(profile.orgId, id)
    setCaptureForms(prev => prev.filter(f => f.id !== id))
    toast.success('Formulario eliminado')
  }

  const handleFixPhones = async () => {
    if (!profile?.orgId) return
    setCleaningPhones(true)
    try {
      const res = await fetch('/api/admin/fix-phone-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: profile.orgId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.fixed} registros corregidos`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally { setCleaningPhones(false) }
  }

  const handleCleanFakes = async () => {
    if (!profile?.orgId) return
    setCleaningFakes(true)
    try {
      const res = await fetch('/api/admin/cleanup-fake-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: profile.orgId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`${data.deleted} clientes falsos eliminados`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally { setCleaningFakes(false) }
  }

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }



  return (
    <div className="space-y-4 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Configuración</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Ajustes de tu organización</p>
      </div>

      {/* Organización */}
      <form onSubmit={handleSave} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Building2 size={20} className="text-slate-500 dark:text-slate-400" />
          <h2 className="font-bold text-slate-900 dark:text-white">Información de la organización</h2>
        </div>

        <div>
          <label className={labelClass}>Nombre de la organización</label>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputClass} placeholder="Mi empresa" />
        </div>

        <div>
          <label className={labelClass}>Industria / Sector</label>
          <input value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
            className={inputClass}
            placeholder="Ej: Agencia de vehículos, Inmobiliaria, Consultoría..." />
        </div>

        <div>
          <label className={labelClass}>Número de WhatsApp del negocio</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">+</span>
            <input value={form.whatsappNumber} onChange={e => setForm(f => ({ ...f, whatsappNumber: e.target.value.replace(/\D/g, '') }))}
              className={inputClass + ' pl-6'}
              placeholder="5491112345678  (código país + número sin espacios ni +)" />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Se usa en el botón &quot;Consultar por WhatsApp&quot; del catálogo público</p>
        </div>

        <button type="submit" disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* WhatsApp — Baileys QR */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <MessageCircle size={20} className="text-slate-500 dark:text-slate-400" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">WhatsApp</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Escanea el QR con tu teléfono para vincular tu número</p>
          </div>
        </div>
        <BaileysQR orgId={profile?.orgId || ''} />
      </div>

      {/* Instagram */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Instagram size={20} className="text-slate-500 dark:text-slate-400" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Instagram</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Conecta tu cuenta de Instagram para recibir mensajes directos</p>
          </div>
        </div>
        <InstagramConnect />
      </div>

      {/* Meta Cloud API — oculto, usando Baileys */}

      {/* Etapas del pipeline */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <GitBranch size={20} className="text-slate-500 dark:text-slate-400" />
          <h2 className="font-bold text-slate-900 dark:text-white">Etapas del pipeline</h2>
        </div>
        <div className="space-y-2">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-sm text-slate-800 dark:text-slate-200">{stage.name}</span>
              </div>
              <button onClick={() => handleDeleteStage(stage.id)}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddStage} className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <input value={newStage.name} onChange={e => setNewStage(s => ({ ...s, name: e.target.value }))}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              placeholder="Nombre de la etapa" />
            <input type="color" value={newStage.color} onChange={e => setNewStage(s => ({ ...s, color: e.target.value }))}
              className="w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer p-1 flex-shrink-0 bg-slate-50 dark:bg-slate-800" />
          </div>
          <button type="submit" disabled={savingStage || !newStage.name}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
            <Plus size={14} /> Añadir etapa
          </button>
        </form>
      </div>

      {/* Estados de clientes */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Tag size={20} className="text-slate-500 dark:text-slate-400" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Estados de clientes</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Personaliza los estados que aparecen en el campo "Estado" de cada cliente</p>
          </div>
        </div>
        <div className="space-y-2">
          {clientStatuses.map(s => (
            <div key={s.value} className="flex items-center gap-2 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <span className="text-xs font-mono text-slate-400 dark:text-slate-500 w-24 flex-shrink-0 truncate">{s.value}</span>
              <input
                defaultValue={s.label}
                onBlur={e => { if (e.target.value.trim() !== s.label) handleRenameStatus(s.value, e.target.value) }}
                className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button onClick={() => handleDeleteStatus(s.value)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddStatus} className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            value={newStatus.label}
            onChange={e => setNewStatus(s => ({ ...s, label: e.target.value }))}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            placeholder='Nombre del estado (ej: "Ganado", "En proceso"...)'
          />
          <button type="submit" disabled={savingStatuses || !newStatus.label.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
            <Plus size={14} /> Añadir estado
          </button>
        </form>
      </div>

      {/* Plantillas de WhatsApp */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <MessageCircle size={20} className="text-slate-500 dark:text-slate-400" />
          <h2 className="font-bold text-slate-900 dark:text-white">Plantillas de WhatsApp</h2>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin plantillas. Crea respuestas rápidas para el chat.</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{t.body}</p>
                </div>
                <button onClick={() => handleDeleteTemplate(t.id)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSaveTemplate} className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <input value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
            className={inputClass} placeholder='Nombre de la plantilla (ej: "Bienvenida")' />
          <textarea value={newTemplate.body} onChange={e => setNewTemplate(t => ({ ...t, body: e.target.value }))}
            rows={2} className={`${inputClass} resize-none`} placeholder="Texto del mensaje..." />
          <button type="submit" disabled={savingTemplate || !newTemplate.name || !newTemplate.body}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
            <Plus size={14} /> Guardar plantilla
          </button>
        </form>
      </div>

      {/* Auto-reply bot */}
      <form onSubmit={handleSaveAutoReply} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Bot size={20} className="text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Respuesta automática de WhatsApp</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Se envía automáticamente al recibir un mensaje nuevo</p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setAutoReply(a => ({ ...a, enabled: !a.enabled }))}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${autoReply.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${autoReply.enabled ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">{autoReply.enabled ? 'Respuesta automática activada' : 'Respuesta automática desactivada'}</span>
        </label>
        {autoReply.enabled && (
          <div>
            <label className={labelClass}>Mensaje automático</label>
            <textarea
              value={autoReply.message}
              onChange={e => setAutoReply(a => ({ ...a, message: e.target.value }))}
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Ej: Gracias por contactarnos. En breve te atendemos..."
            />
          </div>
        )}
        <button type="submit" disabled={savingAutoReply}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
          {savingAutoReply ? 'Guardando...' : 'Guardar respuesta automática'}
        </button>
      </form>

      {/* Mensaje de ventana 24h */}
      <form onSubmit={handleSaveWindowMsg} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <Bot size={20} className="text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Mensaje de seguimiento automático</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Se envía automáticamente X horas después del primer mensaje de un cliente nuevo (ventana de 24h de WhatsApp)</p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setWindowMsg(w => ({ ...w, enabled: !w.enabled }))}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${windowMsg.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${windowMsg.enabled ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">{windowMsg.enabled ? 'Activado' : 'Desactivado'}</span>
        </label>
        {windowMsg.enabled && (
          <>
            <div>
              <label className={labelClass}>Horas de espera tras el primer mensaje</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={23}
                  value={windowMsg.delayHours}
                  onChange={e => setWindowMsg(w => ({ ...w, delayHours: Math.min(23, Math.max(1, Number(e.target.value))) }))}
                  className={`${inputClass} w-24`}
                />
                <span className="text-sm text-slate-500 dark:text-slate-400">horas (máx. 23h para estar dentro de la ventana)</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Mensaje a enviar</label>
              <textarea
                value={windowMsg.message}
                onChange={e => setWindowMsg(w => ({ ...w, message: e.target.value }))}
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Ej: ¡Hola! Solo quería asegurarme de que recibiste toda la información. ¿Tienes alguna pregunta?"
              />
            </div>
          </>
        )}
        <button type="submit" disabled={savingWindowMsg}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
          {savingWindowMsg ? 'Guardando...' : 'Guardar mensaje de seguimiento'}
        </button>
      </form>

      {/* Formulario de calificación */}
      <form onSubmit={handleSaveQualForm} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <ClipboardList size={20} className="text-slate-500 dark:text-slate-400" />
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Formulario de calificación</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Se envía automáticamente por WhatsApp cuando un nuevo contacto escribe</p>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setQualForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${qualForm.enabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${qualForm.enabled ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-slate-700 dark:text-slate-300">{qualForm.enabled ? 'Formulario activado' : 'Formulario desactivado'}</span>
        </label>

        {/* Lista de preguntas */}
        {qualForm.questions.length > 0 && (
          <div className="space-y-2">
            {qualForm.questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 py-2 px-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <GripVertical size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0" />
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono w-4 flex-shrink-0">{i + 1}.</span>
                <p className="flex-1 text-sm text-slate-800 dark:text-slate-200 truncate">{q.text}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${questionTypeBadge[q.type]}`}>
                  {questionTypeLabel[q.type]}
                </span>
                {q.autoTag && (
                  <span title="Guardar como etiqueta" className="flex-shrink-0 text-orange-500">
                    <Tag size={13} />
                  </span>
                )}
                <button type="button" onClick={() => handleDeleteQuestion(q.id)}
                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {qualForm.questions.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-3">Sin preguntas. Añade la primera abajo.</p>
        )}

        {/* Añadir pregunta */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nueva pregunta</p>
          <input
            value={newQuestion.text}
            onChange={e => setNewQuestion(q => ({ ...q, text: e.target.value }))}
            placeholder="Escribe la pregunta..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 transition-colors"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddQuestion(e) } }}
          />
          <select
            value={newQuestion.type}
            onChange={e => setNewQuestion(q => ({ ...q, type: e.target.value as QualificationQuestionType }))}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-colors"
          >
            <option value="text">Texto libre</option>
            <option value="phone">Teléfono (se guarda como número)</option>
            <option value="yes_no">Sí / No</option>
            <option value="number">Número</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={newQuestion.autoTag}
              onChange={e => setNewQuestion(q => ({ ...q, autoTag: e.target.checked }))}
              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 cursor-pointer"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Tag size={13} className="text-orange-500" /> Guardar respuesta como etiqueta del cliente
            </span>
          </label>
          <button type="button" onClick={handleAddQuestion} disabled={!newQuestion.text.trim()}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
            <Plus size={14} /> Añadir pregunta
          </button>
        </div>

        {/* Mensaje de cierre */}
        <div>
          <label className={labelClass}>Mensaje al finalizar el formulario</label>
          <textarea
            value={qualForm.completionMessage}
            onChange={e => setQualForm(f => ({ ...f, completionMessage: e.target.value }))}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Ej: ¡Gracias! En breve un agente te contactará."
          />
        </div>

        <button type="submit" disabled={savingQualForm}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl shadow-lg shadow-blue-500/20 transition-colors">
          {savingQualForm ? 'Guardando...' : 'Guardar formulario'}
        </button>
      </form>

      {/* Plan */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 sm:p-6">
        <h2 className="font-bold text-slate-900 dark:text-white mb-3">Plan actual</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-slate-700 dark:text-slate-300 font-black capitalize text-lg">{org?.plan || 'Trial'}</span>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">Para cambiar de plan contacta al administrador</p>
          </div>
          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm px-3 py-1 rounded-full font-bold capitalize border border-slate-200 dark:border-slate-700">
            {org?.plan}
          </span>
        </div>
      </div>

      {/* Webhooks salientes */}
      {(profile?.role === 'owner' || profile?.role === 'super_admin') && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <WebhookIcon size={20} className="text-gray-500" />
            <div>
              <h2 className="font-semibold text-gray-900">Webhooks salientes</h2>
              <p className="text-xs text-gray-400 mt-0.5">Notifica sistemas externos cuando ocurren eventos</p>
            </div>
          </div>
          {webhooks.length > 0 && (
            <div className="space-y-2">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex items-start gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-gray-700 truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wh.events.map(ev => <span key={ev} className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{ev}</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div onClick={() => handleToggleWebhook(wh)}
                      className={`relative w-8 h-5 rounded-full cursor-pointer transition-colors ${wh.active ? 'bg-gray-900' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${wh.active ? 'left-3.5' : 'left-0.5'}`} />
                    </div>
                    <button onClick={() => handleDeleteWebhook(wh.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleAddWebhook} className="space-y-3 pt-2 border-t border-gray-100">
            <input value={newWebhook.url} onChange={e => setNewWebhook(w => ({ ...w, url: e.target.value }))}
              className={inputClass} placeholder="https://mi-sistema.com/webhook" />
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">Eventos a notificar</p>
              <div className="flex flex-wrap gap-2">
                {WEBHOOK_EVENTS.map(ev => (
                  <label key={ev.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newWebhook.events.includes(ev.value)}
                      onChange={e => setNewWebhook(w => ({
                        ...w,
                        events: e.target.checked ? [...w.events, ev.value] : w.events.filter(x => x !== ev.value)
                      }))}
                      className="w-3.5 h-3.5 rounded" />
                    <span className="text-xs text-gray-700">{ev.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="submit" disabled={savingWebhook || !newWebhook.url}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
              <Plus size={14} /> Añadir webhook
            </button>
          </form>
        </div>
      )}

      {/* Formularios de captura */}
      {(profile?.role === 'owner' || profile?.role === 'super_admin' || profile?.role === 'manager') && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <FormInput size={20} className="text-gray-500" />
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900">Formularios de captura</h2>
              <p className="text-xs text-gray-400 mt-0.5">Crea formularios públicos para capturar leads automáticamente</p>
            </div>
          </div>
          {captureForms.length > 0 && (
            <div className="space-y-2">
              {captureForms.map(f => {
                const formUrl = typeof window !== 'undefined' ? `${window.location.origin}/form/${profile?.orgId}/${f.id}` : ''
                return (
                  <div key={f.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{f.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{f.fields.length} campo(s) · {f.submissionCount} envíos</p>
                    </div>
                    <a href={formUrl} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors" title="Ver formulario">
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => { navigator.clipboard.writeText(formUrl); toast.success('URL copiada') }}
                      className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors" title="Copiar URL">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => handleDeleteForm(f.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
          {!showFormBuilder ? (
            <button onClick={() => setShowFormBuilder(true)}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm rounded-lg transition-colors">
              <Plus size={14} /> Crear formulario
            </button>
          ) : (
            <form onSubmit={handleSaveCaptureForm} className="space-y-3 pt-2 border-t border-gray-100">
              <input value={newFormName} onChange={e => setNewFormName(e.target.value)}
                className={inputClass} placeholder='Nombre del formulario (ej: "Contacto web")' />
              <div className="space-y-2">
                {newFormFields.map(field => (
                  <div key={field.id} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                    <input value={field.label} onChange={e => updateFormField(field.id, { label: e.target.value })}
                      className="flex-1 bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-900 focus:outline-none" placeholder="Etiqueta del campo" />
                    <select value={field.type} onChange={e => updateFormField(field.id, { type: e.target.value as CaptureFormField['type'] })}
                      className="bg-white border border-gray-200 rounded px-2 py-1.5 text-xs text-gray-700 focus:outline-none">
                      <option value="text">Texto</option>
                      <option value="email">Email</option>
                      <option value="phone">Teléfono</option>
                      <option value="textarea">Área de texto</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <input type="checkbox" checked={field.required} onChange={e => updateFormField(field.id, { required: e.target.checked })} className="w-3 h-3" /> Req.
                    </label>
                    <button type="button" onClick={() => setNewFormFields(prev => prev.filter(f => f.id !== field.id))}
                      className="p-1 text-gray-400 hover:text-red-500 rounded">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" onClick={addFormField}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors">
                <Plus size={13} /> Añadir campo
              </button>
              <input value={newFormConfirmation} onChange={e => setNewFormConfirmation(e.target.value)}
                className={inputClass} placeholder="Mensaje de confirmación al enviar" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowFormBuilder(false)} className="flex-1 px-3 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={savingForm}
                  className="flex-1 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors py-2.5">
                  {savingForm ? 'Guardando...' : 'Crear formulario'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Facturación */}
      {(profile?.role === 'owner' || profile?.role === 'super_admin') && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <CreditCard size={20} className="text-gray-500" />
            <div>
              <h2 className="font-semibold text-gray-900">Facturación</h2>
              <p className="text-xs text-gray-400 mt-0.5">Gestiona tu plan y métodos de pago</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { plan: 'trial' as const, name: 'Trial', price: 'Gratis', features: ['1 usuario', '100 clientes', 'WhatsApp básico'] },
              { plan: 'basic' as const, name: 'Básico', price: '$29/mes', features: ['5 usuarios', '1,000 clientes', 'WhatsApp + Instagram', 'Reportes básicos'] },
              { plan: 'pro' as const, name: 'Pro', price: '$79/mes', features: ['Usuarios ilimitados', 'Clientes ilimitados', 'Todos los canales', 'Reportes avanzados', 'Webhooks', 'Formularios'] },
            ].map(tier => {
              const current = org?.plan === tier.plan
              return (
                <div key={tier.plan} className={`p-4 rounded-xl border-2 transition-all ${current ? 'border-gray-900 bg-gray-50' : 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{tier.name}</span>
                      {current && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">Plan actual</span>}
                    </div>
                    <span className="font-semibold text-gray-700">{tier.price}</span>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {tier.features.map(f => (
                      <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5">
                        <CheckCircle size={11} className="text-green-500 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  {!current && (
                    <button onClick={async () => {
                      try {
                        const res = await fetch('/api/billing/checkout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orgId: profile?.orgId, plan: tier.plan }),
                        })
                        const data = await res.json()
                        if (data.url) window.location.href = data.url
                        else toast.error(data.error || 'Error al iniciar pago')
                      } catch { toast.error('Error de conexión') }
                    }}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm py-2 rounded-lg transition-colors">
                      Cambiar a {tier.name}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Mantenimiento — solo owners */}
      {profile?.role === 'owner' && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Wrench size={20} className="text-slate-500 dark:text-slate-400" />
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Mantenimiento de datos</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Herramientas para limpiar datos incorrectos</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Corregir teléfonos inválidos</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Elimina campos de teléfono con texto en lugar de números</p>
              </div>
              <button onClick={handleFixPhones} disabled={cleaningPhones}
                className="flex-shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                {cleaningPhones ? 'Procesando...' : 'Ejecutar'}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Eliminar contactos falsos de WhatsApp</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Elimina clientes creados por newsletters, broadcasts o JIDs inválidos</p>
              </div>
              <button onClick={handleCleanFakes} disabled={cleaningFakes}
                className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors">
                {cleaningFakes ? 'Procesando...' : 'Limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
