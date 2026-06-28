'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, updateOrganization } from '@/lib/firestore'
import type { Organization } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import InstagramConnect from '@/components/settings/InstagramConnect'
import {
  Building2, MessageCircle, Instagram, Bot, Eye, EyeOff, Clock
} from 'lucide-react'
import { Card, SectionHeader, PageHeader, Spinner, inputClass, labelClass } from '@/components/ui/primitives'

type Tab = 'negocio' | 'conexiones' | 'bot'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'negocio',    label: 'Negocio',     icon: Building2 },
  { id: 'conexiones', label: 'Conexiones',  icon: MessageCircle },
  { id: 'bot',        label: 'Bot N8N',     icon: Bot },
]

const INDUSTRY_OPTIONS = [
  'Restaurante',
  'Real Estate / Inmobiliaria',
  'Clínica / Salud',
  'Taller mecánico',
  'Agencia de marketing',
  'Salón / Spa',
  'Otro',
]

export default function SettingsPage() {
  const { profile } = useAuth()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab) || 'negocio'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  // Tab: Negocio
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [businessHours, setBusinessHours] = useState({ days: [1, 2, 3, 4, 5], openTime: '08:00', closeTime: '18:00' })
  const [savingNegocio, setSavingNegocio] = useState(false)

  // Tab: Bot
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [n8nMode, setN8nMode] = useState<'always' | 'outside_hours' | 'off'>('always')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingBot, setSavingBot] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  useEffect(() => {
    if (!profile?.orgId) { setLoading(false); return }
    getOrganization(profile.orgId).then(o => {
      if (o) {
        setOrg(o)
        setName(o.name)
        setIndustry(o.settings.industry || '')
        setWhatsappNumber(o.settings.whatsappNumber || '')
        setWebsiteUrl(o.settings.websiteUrl || '')
        if (o.settings.businessHours) {
          setBusinessHours({
            days: o.settings.businessHours.days,
            openTime: o.settings.businessHours.openTime,
            closeTime: o.settings.businessHours.closeTime,
          })
        }
        setN8nWebhookUrl(o.settings.n8nWebhookUrl || '')
        setN8nApiKey(o.settings.n8nApiKey || '')
        setN8nMode(o.settings.n8nMode || 'always')
      }
    }).finally(() => setLoading(false))
  }, [profile])

  const handleSaveNegocio = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !org) return
    setSavingNegocio(true)
    try {
      await updateOrganization(profile.orgId, {
        name,
        settings: {
          ...org.settings,
          industry,
          whatsappNumber: whatsappNumber.trim(),
          websiteUrl: websiteUrl.trim(),
          businessHours: {
            ...org.settings.businessHours,
            days: businessHours.days,
            openTime: businessHours.openTime,
            closeTime: businessHours.closeTime,
            slotMinutes: org.settings.businessHours?.slotMinutes ?? 60,
          },
        },
      })
      setOrg(prev => prev ? { ...prev, name, settings: { ...prev.settings, industry, whatsappNumber, websiteUrl, businessHours: { ...prev.settings.businessHours, days: businessHours.days, openTime: businessHours.openTime, closeTime: businessHours.closeTime, slotMinutes: prev.settings.businessHours?.slotMinutes ?? 60 } } } : prev)
      toast.success('Guardado')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingNegocio(false)
    }
  }

  const handleSaveBot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.orgId || !org) return
    setSavingBot(true)
    try {
      await updateOrganization(profile.orgId, {
        settings: {
          ...org.settings,
          n8nWebhookUrl: n8nWebhookUrl.trim(),
          n8nApiKey: n8nApiKey.trim(),
          n8nMode,
        },
      })
      setOrg(prev => prev ? { ...prev, settings: { ...prev.settings, n8nWebhookUrl: n8nWebhookUrl.trim(), n8nApiKey: n8nApiKey.trim(), n8nMode } } : prev)
      toast.success('Configuración del bot guardada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSavingBot(false)
    }
  }

  const handleTestBot = async () => {
    if (!profile?.orgId) return
    setTestStatus('testing')
    try {
      const res = await fetch('/api/bot/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: profile.orgId,
          clientPhone: '0000000000',
          clientName: 'Test',
          message: '[Prueba de conexión desde CRM]',
          channel: 'whatsapp',
        }),
      })
      setTestStatus(res.ok ? 'ok' : 'error')
    } catch {
      setTestStatus('error')
    }
  }

  if (loading) return <Spinner />

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Configuración" subtitle="Ajustes de tu organización" />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F4F5F7] dark:bg-[#1A2540]/60 p-1 rounded-md overflow-x-auto">
        {TABS.map(tab => (
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

      {/* ── NEGOCIO ─────────────────────────────────────── */}
      {activeTab === 'negocio' && (
        <form onSubmit={handleSaveNegocio} className="space-y-4">
          <Card className="space-y-4">
            <SectionHeader icon={Building2} title="Información del negocio" />
            <div>
              <label className={labelClass}>Nombre de la organización</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className={inputClass}
                placeholder="Mi empresa"
              />
            </div>
            <div>
              <label className={labelClass}>Industria / Sector</label>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona...</option>
                {INDUSTRY_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Número de WhatsApp del negocio</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] text-sm">+</span>
                <input
                  value={whatsappNumber}
                  onChange={e => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                  className={inputClass + ' pl-6'}
                  placeholder="5491112345678"
                />
              </div>
              <p className="text-xs text-[#9BA5B7] dark:text-[#68748D] mt-1">Código de país + número, sin espacios ni +</p>
            </div>
            <div>
              <label className={labelClass}>URL del sitio web vinculado</label>
              <input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                className={inputClass}
                placeholder="https://mi-sitio.com"
              />
            </div>
          </Card>

          <Card className="space-y-4">
            <SectionHeader icon={Clock} title="Horario de atención" desc="Días y horas en que el negocio está disponible" />
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
          </Card>

          <button
            type="submit"
            disabled={savingNegocio}
            className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow-lg transition-colors"
          >
            {savingNegocio ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
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

      {/* ── BOT N8N ─────────────────────────────────────── */}
      {activeTab === 'bot' && (
        <form onSubmit={handleSaveBot} className="space-y-4">
          <Card className="space-y-4">
            <SectionHeader icon={Bot} title="Bot N8N" desc="Conecta tu flujo de N8N para calificar leads automáticamente" />

            <div>
              <label className={labelClass}>URL del webhook de N8N</label>
              <input
                type="url"
                value={n8nWebhookUrl}
                onChange={e => setN8nWebhookUrl(e.target.value)}
                className={inputClass}
                placeholder="https://mi-n8n.com/webhook/..."
              />
            </div>

            <div>
              <label className={labelClass}>API Key secreta</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={n8nApiKey}
                  onChange={e => setN8nApiKey(e.target.value)}
                  className={inputClass + ' pr-10'}
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9BA5B7] hover:text-[#68748D] transition-colors"
                >
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className={labelClass}>Modo de activación</label>
              <div className="space-y-2 mt-2">
                {([
                  { value: 'always', label: 'Siempre activo', badge: 'Recomendado', desc: 'El bot califica leads dentro y fuera del horario — máxima automatización y ventas' },
                  { value: 'outside_hours', label: 'Solo fuera de horario', badge: null, desc: 'El bot responde solo cuando el negocio está cerrado' },
                  { value: 'off', label: 'Desactivado', badge: null, desc: 'El bot no responde ningún mensaje' },
                ] as const).map(opt => (
                  <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="n8nMode"
                      value={opt.value}
                      checked={n8nMode === opt.value}
                      onChange={() => setN8nMode(opt.value)}
                      className="mt-0.5 accent-[#0D7A65]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[#0C1224] dark:text-[#E8ECF4]">{opt.label}</p>
                        {opt.badge && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0D7A65]/10 text-[#0D7A65] uppercase tracking-wide">{opt.badge}</span>}
                      </div>
                      <p className="text-xs text-[#9BA5B7]">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Test connection */}
            <div className="pt-3 border-t border-[#E3E6EC] dark:border-[#1A2540]">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleTestBot}
                  disabled={testStatus === 'testing' || !n8nWebhookUrl}
                  className="px-4 py-2 bg-[#F4F5F7] dark:bg-[#1A2540] hover:bg-[#E3E6EC] dark:hover:bg-[#0F1829] disabled:opacity-50 text-[#0C1224] dark:text-[#E8ECF4] text-sm font-bold rounded-md transition-colors border border-[#E3E6EC] dark:border-[#1A2540]"
                >
                  {testStatus === 'testing' ? 'Probando...' : 'Probar conexión'}
                </button>
                {testStatus === 'ok' && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Online
                  </span>
                )}
                {testStatus === 'error' && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Error
                  </span>
                )}
              </div>
            </div>
          </Card>

          <button
            type="submit"
            disabled={savingBot}
            className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-50 text-white font-bold py-2.5 rounded-md shadow-lg transition-colors"
          >
            {savingBot ? 'Guardando...' : 'Guardar configuración del bot'}
          </button>
        </form>
      )}
    </div>
  )
}
