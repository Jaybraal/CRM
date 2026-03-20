'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, saveWhatsAppConfig, getWhatsAppTemplates, createWhatsAppTemplate, deleteWhatsAppTemplate } from '@/lib/firestore'
import { updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Organization, WhatsAppTemplate, PipelineStage } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import { Building2, MessageCircle, Copy, CheckCircle, Plus, Trash2, GitBranch, Bot } from 'lucide-react'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

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
      }
      setTemplates(tmpl)
    })
    .catch(e => console.error('Error cargando configuración:', e))
    .finally(() => setLoading(false))
  }, [profile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'organizations', profile.orgId), {
        name: form.name,
        'settings.industry': form.industry,
      })
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
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
      await createWhatsAppTemplate(profile.orgId, newTemplate)
      const updated = await getWhatsAppTemplates(profile.orgId)
      setTemplates(updated)
      setNewTemplate({ name: '', body: '' })
      toast.success('Plantilla guardada')
    } catch { toast.error('Error al guardar') }
    finally { setSavingTemplate(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!profile?.orgId) return
    await deleteWhatsAppTemplate(profile.orgId, id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    toast.success('Plantilla eliminada')
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
      await updateDoc(doc(db, 'organizations', profile.orgId), { 'settings.pipelineStages': updated })
      setStages(updated)
      setNewStage({ name: '', color: '#6b7280' })
      toast.success('Etapa añadida')
    } catch { toast.error('Error al guardar') }
    finally { setSavingStage(false) }
  }

  const handleDeleteStage = async (id: string) => {
    if (!profile?.orgId) return
    const updated = stages.filter(s => s.id !== id)
    await updateDoc(doc(db, 'organizations', profile.orgId), { 'settings.pipelineStages': updated })
    setStages(updated)
    toast.success('Etapa eliminada')
  }

  const handleSaveAutoReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId) return
    setSavingAutoReply(true)
    try {
      await updateDoc(doc(db, 'organizations', profile.orgId), {
        'settings.autoReply': autoReply,
      })
      toast.success('Respuesta automática guardada')
    } catch { toast.error('Error al guardar') }
    finally { setSavingAutoReply(false) }
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
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-1">Ajustes de tu organización</p>
      </div>

      {/* Organización */}
      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
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
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <MessageCircle size={20} className="text-gray-500" />
          <div>
            <h2 className="font-semibold text-gray-900">WhatsApp</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escanea el QR con tu teléfono para vincular tu número</p>
          </div>
        </div>
        <BaileysQR />
      </div>

      {/* WhatsApp — Meta Cloud API (opcional) */}
      <form onSubmit={handleSaveWhatsApp} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
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
          <div className="flex gap-2">
            <input readOnly value={webhookUrl}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-600 select-all" />
            <button type="button" onClick={copyWebhook}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">
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
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
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
        <form onSubmit={handleAddStage} className="flex gap-2 pt-2 border-t border-gray-100">
          <input value={newStage.name} onChange={e => setNewStage(s => ({ ...s, name: e.target.value }))}
            className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-500"
            placeholder="Nombre de la etapa" />
          <input type="color" value={newStage.color} onChange={e => setNewStage(s => ({ ...s, color: e.target.value }))}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-1" />
          <button type="submit" disabled={savingStage || !newStage.name}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors">
            <Plus size={14} /> Añadir
          </button>
        </form>
      </div>

      {/* Plantillas de WhatsApp */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus size={14} /> Guardar plantilla
          </button>
        </form>
      </div>

      {/* Auto-reply bot */}
      <form onSubmit={handleSaveAutoReply} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
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

      {/* Plan */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
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
    </div>
  )
}
