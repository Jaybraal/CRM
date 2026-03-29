'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, saveWhatsAppConfig, getWhatsAppTemplates } from '@/lib/firestore'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Organization, WhatsAppTemplate, PipelineStage, QualificationQuestion, QualificationQuestionType } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import { Building2, MessageCircle, Copy, CheckCircle, Plus, Trash2, GitBranch, Bot, Wrench, ClipboardList, GripVertical } from 'lucide-react'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
const cardClass = 'bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4'

export default function SettingsPage() {
  const { profile } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingWa, setSavingWa] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ name: '', industry: '' })
  const [waForm, setWaForm] = useState({ phoneNumberId: '', token: '' })
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [newTemplate, setNewTemplate] = useState({ name: '', body: '' })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [newStage, setNewStage] = useState({ name: '', color: '#6b7280' })
  const [savingStage, setSavingStage] = useState(false)
  const [autoReply, setAutoReply] = useState({ enabled: false, message: '' })
  const [savingAutoReply, setSavingAutoReply] = useState(false)
  const [qualForm, setQualForm] = useState<{
    enabled: boolean
    questions: QualificationQuestion[]
    completionMessage: string
  }>({ enabled: false, questions: [], completionMessage: '' })
  const [newQuestion, setNewQuestion] = useState({ text: '', type: 'text' as QualificationQuestionType })
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
    ]).then(([o, tmpl]) => {
      if (o) {
        setOrg(o)
        setForm({ name: o.name, industry: o.settings.industry })
        setWaForm({
          phoneNumberId: o.settings.whatsapp?.phoneNumberId || '',
          token: o.settings.whatsapp?.token || '',
        })
        setStages(o.settings.pipelineStages || DEFAULT_STAGES)
        setAutoReply({
          enabled: o.settings.autoReply?.enabled || false,
          message: o.settings.autoReply?.message || '',
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
      await callApi({ action: 'save_org', name: form.name, industry: form.industry })
      toast.success('Configuración guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveWhatsApp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !waForm.phoneNumberId || !waForm.token) return
    setSavingWa(true)
    try {
      await updateDoc(doc(db, 'organizations', profile.orgId), {
        'settings.whatsapp.phoneNumberId': waForm.phoneNumberId.trim(),
        'settings.whatsapp.token': waForm.token.trim(),
      })
      await saveWhatsAppConfig(waForm.phoneNumberId.trim(), profile.orgId, waForm.token.trim())
      setOrg(prev => prev ? {
        ...prev,
        settings: {
          ...prev.settings,
          whatsapp: { phoneNumberId: waForm.phoneNumberId.trim(), token: waForm.token.trim() }
        }
      } : prev)
      toast.success('WhatsApp vinculado correctamente')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingWa(false)
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
    }
    setQualForm(f => ({ ...f, questions: [...f.questions, q] }))
    setNewQuestion({ text: '', type: 'text' })
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
    text: 'bg-gray-100 text-gray-600',
    phone: 'bg-green-100 text-green-700',
    yes_no: 'bg-blue-100 text-blue-700',
    number: 'bg-purple-100 text-purple-700',
  }

  const [cleaningPhones, setCleaningPhones] = useState(false)
  const [cleaningFakes, setCleaningFakes] = useState(false)

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
    return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>
  }

  const waConnected = !!org?.settings?.whatsapp?.phoneNumberId

  return (
    <div className="space-y-4 w-full max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes de tu organización</p>
      </div>

      {/* Organización */}
      <form onSubmit={handleSave} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Building2 size={20} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Información de la organización</h2>
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

        <button type="submit" disabled={saving}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      {/* WhatsApp — Baileys QR */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <MessageCircle size={20} className="text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900">WhatsApp</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escanea el QR con tu teléfono para vincular tu número</p>
          </div>
        </div>
        <BaileysQR orgId={profile?.orgId || ''} />
      </div>

      {/* WhatsApp — Meta Cloud API (opcional) */}
      <form onSubmit={handleSaveWhatsApp} className={cardClass}>
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <MessageCircle size={20} className="text-gray-400" />
            <div>
              <h2 className="font-semibold text-gray-900">Meta Cloud API <span className="text-xs font-normal text-gray-400 ml-1">(opcional)</span></h2>
              <p className="text-xs text-gray-400 mt-0.5">Solo si usas la API oficial de Meta Business</p>
            </div>
          </div>
          {waConnected && (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
              <CheckCircle size={12} /> Configurado
            </span>
          )}
        </div>

        {/* Webhook URL */}
        <div>
          <label className={labelClass}>URL del Webhook</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input readOnly value={webhookUrl}
              className="flex-1 min-w-0 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 select-all truncate" />
            <button type="button" onClick={copyWebhook}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors shrink-0">
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Token de verificación:{' '}
            <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
              {process.env.NEXT_PUBLIC_WA_VERIFY_TOKEN || 'crm_webhook_2024'}
            </span>
          </p>
        </div>

        <div>
          <label className={labelClass}>Phone Number ID</label>
          <input value={waForm.phoneNumberId}
            onChange={e => setWaForm(f => ({ ...f, phoneNumberId: e.target.value }))}
            className={inputClass} placeholder="123456789012345" />
        </div>

        <div>
          <label className={labelClass}>Token de acceso</label>
          <input type="password" value={waForm.token}
            onChange={e => setWaForm(f => ({ ...f, token: e.target.value }))}
            className={inputClass} placeholder="EAAxxxxxxxxx..." />
        </div>

        <button type="submit" disabled={savingWa || !waForm.phoneNumberId || !waForm.token}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {savingWa ? 'Guardando...' : waConnected ? 'Actualizar' : 'Guardar'}
        </button>
      </form>

      {/* Etapas del pipeline */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <GitBranch size={20} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Etapas del pipeline</h2>
        </div>
        <div className="space-y-2">
          {stages.map(stage => (
            <div key={stage.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <span className="text-sm text-gray-800">{stage.name}</span>
              </div>
              <button onClick={() => handleDeleteStage(stage.id)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddStage} className="flex flex-col gap-2 pt-2 border-t border-gray-100">
          <div className="flex gap-2">
            <input value={newStage.name} onChange={e => setNewStage(s => ({ ...s, name: e.target.value }))}
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
              placeholder="Nombre de la etapa" />
            <input type="color" value={newStage.color} onChange={e => setNewStage(s => ({ ...s, color: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1 flex-shrink-0" />
          </div>
          <button type="submit" disabled={savingStage || !newStage.name}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
            <Plus size={14} /> Añadir etapa
          </button>
        </form>
      </div>

      {/* Plantillas de WhatsApp */}
      <div className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <MessageCircle size={20} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Plantillas de WhatsApp</h2>
        </div>
        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">Sin plantillas. Crea respuestas rápidas para el chat.</p>
        ) : (
          <div className="space-y-2">
            {templates.map(t => (
              <div key={t.id} className="flex items-start justify-between gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.body}</p>
                </div>
                <button onClick={() => handleDeleteTemplate(t.id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={handleSaveTemplate} className="space-y-3 pt-2 border-t border-gray-100">
          <input value={newTemplate.name} onChange={e => setNewTemplate(t => ({ ...t, name: e.target.value }))}
            className={inputClass} placeholder='Nombre de la plantilla (ej: "Bienvenida")' />
          <textarea value={newTemplate.body} onChange={e => setNewTemplate(t => ({ ...t, body: e.target.value }))}
            rows={2} className={`${inputClass} resize-none`} placeholder="Texto del mensaje..." />
          <button type="submit" disabled={savingTemplate || !newTemplate.name || !newTemplate.body}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={14} /> Guardar plantilla
          </button>
        </form>
      </div>

      {/* Auto-reply bot */}
      <form onSubmit={handleSaveAutoReply} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Bot size={20} className="text-gray-500" />
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Respuesta automática de WhatsApp</h2>
            <p className="text-xs text-gray-400 mt-0.5">Se envía automáticamente al recibir un mensaje nuevo</p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setAutoReply(a => ({ ...a, enabled: !a.enabled }))}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${autoReply.enabled ? 'bg-gray-900' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${autoReply.enabled ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-gray-700">{autoReply.enabled ? 'Respuesta automática activada' : 'Respuesta automática desactivada'}</span>
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
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {savingAutoReply ? 'Guardando...' : 'Guardar respuesta automática'}
        </button>
      </form>

      {/* Formulario de calificación */}
      <form onSubmit={handleSaveQualForm} className={cardClass}>
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <ClipboardList size={20} className="text-gray-500" />
          <div className="flex-1">
            <h2 className="font-semibold text-gray-900">Formulario de calificación</h2>
            <p className="text-xs text-gray-400 mt-0.5">Se envía automáticamente por WhatsApp cuando un nuevo contacto escribe</p>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setQualForm(f => ({ ...f, enabled: !f.enabled }))}
            className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${qualForm.enabled ? 'bg-gray-900' : 'bg-gray-300'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${qualForm.enabled ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-sm text-gray-700">{qualForm.enabled ? 'Formulario activado' : 'Formulario desactivado'}</span>
        </label>

        {/* Lista de preguntas */}
        {qualForm.questions.length > 0 && (
          <div className="space-y-2">
            {qualForm.questions.map((q, i) => (
              <div key={q.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-lg">
                <GripVertical size={14} className="text-gray-300 flex-shrink-0" />
                <span className="text-xs text-gray-400 font-mono w-4 flex-shrink-0">{i + 1}.</span>
                <p className="flex-1 text-sm text-gray-800 truncate">{q.text}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${questionTypeBadge[q.type]}`}>
                  {questionTypeLabel[q.type]}
                </span>
                <button type="button" onClick={() => handleDeleteQuestion(q.id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {qualForm.questions.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Sin preguntas. Añade la primera abajo.</p>
        )}

        {/* Añadir pregunta */}
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Nueva pregunta</p>
          <input
            value={newQuestion.text}
            onChange={e => setNewQuestion(q => ({ ...q, text: e.target.value }))}
            placeholder="Escribe la pregunta..."
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddQuestion(e) } }}
          />
          <div className="flex gap-2">
            <select
              value={newQuestion.type}
              onChange={e => setNewQuestion(q => ({ ...q, type: e.target.value as QualificationQuestionType }))}
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gray-500"
            >
              <option value="text">Texto libre</option>
              <option value="phone">Teléfono (se guarda como número)</option>
              <option value="yes_no">Sí / No</option>
              <option value="number">Número</option>
            </select>
            <button type="button" onClick={handleAddQuestion} disabled={!newQuestion.text.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white text-sm rounded-lg transition-colors flex-shrink-0">
              <Plus size={14} /> Añadir
            </button>
          </div>
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
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {savingQualForm ? 'Guardando...' : 'Guardar formulario'}
        </button>
      </form>

      {/* Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
        <h2 className="font-semibold text-gray-900 mb-3">Plan actual</h2>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-gray-700 font-bold capitalize text-lg">{org?.plan || 'Trial'}</span>
            <p className="text-gray-400 text-sm mt-0.5">Para cambiar de plan contacta al administrador</p>
          </div>
          <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full font-medium capitalize border border-gray-200">
            {org?.plan}
          </span>
        </div>
      </div>

      {/* Mantenimiento — solo owners */}
      {profile?.role === 'owner' && (
        <div className={cardClass}>
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
            <Wrench size={20} className="text-gray-500" />
            <div>
              <h2 className="font-semibold text-gray-900">Mantenimiento de datos</h2>
              <p className="text-xs text-gray-400 mt-0.5">Herramientas para limpiar datos incorrectos</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">Corregir teléfonos inválidos</p>
                <p className="text-xs text-gray-500">Elimina campos de teléfono con texto en lugar de números</p>
              </div>
              <button onClick={handleFixPhones} disabled={cleaningPhones}
                className="flex-shrink-0 px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                {cleaningPhones ? 'Procesando...' : 'Ejecutar'}
              </button>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">Eliminar contactos falsos de WhatsApp</p>
                <p className="text-xs text-gray-500">Elimina clientes creados por newsletters, broadcasts o JIDs inválidos</p>
              </div>
              <button onClick={handleCleanFakes} disabled={cleaningFakes}
                className="flex-shrink-0 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
                {cleaningFakes ? 'Procesando...' : 'Limpiar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
