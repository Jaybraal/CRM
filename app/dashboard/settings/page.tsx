'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, updateOrganization } from '@/lib/firestore'
import type { Organization } from '@/types'
import toast from 'react-hot-toast'
import BaileysQR from '@/components/settings/BaileysQR'
import GmailConnect from '@/components/settings/GmailConnect'
import CampaignsManager from '@/components/settings/CampaignsManager'
import { Building2, MessageCircle, Bot, Eye, EyeOff, Clock, MapPin, HelpCircle, Calendar, Plus, Trash2, User, Mail, Megaphone } from 'lucide-react'
import { Card, SectionHeader, PageHeader, Spinner, inputClass, labelClass } from '@/components/ui/primitives'

type Tab = 'negocio' | 'conexiones' | 'campanas' | 'bot'

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'negocio',    label: 'Negocio',     icon: Building2 },
  { id: 'conexiones', label: 'Conexiones',  icon: MessageCircle },
  { id: 'campanas',   label: 'Campañas',    icon: Megaphone },
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

  // Personalidad del bot
  const [botName, setBotName] = useState('')
  const [botIndustry, setBotIndustry] = useState('')
  const [botDescription, setBotDescription] = useState('')
  const [botAssistantName, setBotAssistantName] = useState('')
  const [botTone, setBotTone] = useState<'formal' | 'casual'>('casual')

  // Ubicación
  const [locLat, setLocLat] = useState('')
  const [locLng, setLocLng] = useState('')
  const [locName, setLocName] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [locMapsUrl, setLocMapsUrl] = useState('')

  // FAQ
  const [faq, setFaq] = useState<Array<{ id: string; question: string; answer: string }>>([])

  // Slots
  const [slots, setSlots] = useState<Array<{ day: number; time: string; label: string }>>([])
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
        // Personalidad del bot
        if (o.settings.botPersonality) {
          setBotName(o.settings.botPersonality.businessName || '')
          setBotIndustry(o.settings.botPersonality.industry || '')
          setBotDescription(o.settings.botPersonality.description || '')
          setBotAssistantName(o.settings.botPersonality.assistantName || '')
          setBotTone(o.settings.botPersonality.tone || 'casual')
        }
        // Ubicación
        if (o.settings.businessLocation) {
          setLocLat(String(o.settings.businessLocation.lat || ''))
          setLocLng(String(o.settings.businessLocation.lng || ''))
          setLocName(o.settings.businessLocation.name || '')
          setLocAddress(o.settings.businessLocation.address || '')
          setLocMapsUrl(o.settings.businessLocation.mapsUrl || '')
        }
        // FAQ y slots
        setFaq(o.settings.faq || [])
        setSlots(o.settings.appointmentSlots || [])
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
      const newSettings: Partial<typeof org.settings> = {
        ...org.settings,
        n8nWebhookUrl: n8nWebhookUrl.trim(),
        n8nApiKey: n8nApiKey.trim(),
        n8nMode,
        botPersonality: {
          businessName: botName.trim(),
          industry: botIndustry.trim(),
          description: botDescription.trim(),
          assistantName: botAssistantName.trim() || undefined,
          tone: botTone,
        },
        faq,
        appointmentSlots: slots,
      }
      if (locLat && locLng) {
        const lat = parseFloat(locLat)
        const lng = parseFloat(locLng)
        if (isNaN(lat) || isNaN(lng)) {
          toast.error('Coordenadas de ubicación inválidas (usa punto decimal)')
          setSavingBot(false)
          return
        }
        newSettings.businessLocation = {
          lat,
          lng,
          name: locName.trim(),
          address: locAddress.trim(),
          mapsUrl: locMapsUrl.trim() || undefined,
        }
      }
      await updateOrganization(profile.orgId, { settings: newSettings })
      setOrg(prev => prev ? { ...prev, settings: { ...prev.settings, ...newSettings } } : prev)
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
      const res = await fetch('/api/bot/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: profile.orgId }),
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
            <SectionHeader icon={Mail} title="Gmail / Email de captación" desc="Conecta tu Gmail para enviar campañas de outreach a prospectos" />
            <GmailConnect />
          </Card>
        </div>
      )}

      {/* ── CAMPAÑAS (negocios de outreach) ────────────────── */}
      {activeTab === 'campanas' && (
        <Card className="space-y-4">
          <SectionHeader icon={Megaphone} title="Campañas" desc="Crea un negocio nuevo y su mensaje de outreach sin depender de código" />
          <CampaignsManager />
        </Card>
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

          {/* ── Personalidad del Bot ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={User} title="Personalidad del Bot" desc="Cómo se presenta el bot a tus clientes" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nombre del negocio</label>
                <input className={inputClass} value={botName} onChange={e => setBotName(e.target.value)} placeholder="AutoCentro García" />
              </div>
              <div>
                <label className={labelClass}>Nombre del asistente</label>
                <input className={inputClass} value={botAssistantName} onChange={e => setBotAssistantName(e.target.value)} placeholder="Carlos" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Industria / tipo de negocio</label>
              <input className={inputClass} value={botIndustry} onChange={e => setBotIndustry(e.target.value)} placeholder="venta de autos usados" />
            </div>
            <div>
              <label className={labelClass}>Descripción del negocio</label>
              <textarea className={inputClass} rows={3} value={botDescription} onChange={e => setBotDescription(e.target.value)} placeholder="Vendemos autos usados certificados en Santo Domingo..." />
            </div>
            <div>
              <label className={labelClass}>Tono del bot</label>
              <div className="flex gap-4 mt-1">
                {(['casual', 'formal'] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="tone" value={t} checked={botTone === t} onChange={() => setBotTone(t)} className="accent-[#0D7A65]" />
                    <span className="text-sm capitalize text-[#0C1224] dark:text-[#E8ECF4]">{t}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Ubicación ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={MapPin} title="Ubicación del Negocio" desc="El bot enviará un pin de ubicación cuando el cliente pregunte dónde están" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Latitud</label>
                <input className={inputClass} value={locLat} onChange={e => setLocLat(e.target.value)} placeholder="18.4861" />
              </div>
              <div>
                <label className={labelClass}>Longitud</label>
                <input className={inputClass} value={locLng} onChange={e => setLocLng(e.target.value)} placeholder="-69.9312" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Nombre del local</label>
              <input className={inputClass} value={locName} onChange={e => setLocName(e.target.value)} placeholder="AutoCentro García - Sucursal Principal" />
            </div>
            <div>
              <label className={labelClass}>Dirección completa</label>
              <input className={inputClass} value={locAddress} onChange={e => setLocAddress(e.target.value)} placeholder="Av. 27 de Febrero #123, Santo Domingo" />
            </div>
            <div>
              <label className={labelClass}>Link de Google Maps (opcional)</label>
              <input className={inputClass} value={locMapsUrl} onChange={e => setLocMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>

          {/* ── FAQ ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={HelpCircle} title="Preguntas Frecuentes" desc="El bot usa estas respuestas cuando el cliente hace estas preguntas" />
            <div className="space-y-2">
              {faq.map((item, i) => (
                <div key={item.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      className={inputClass}
                      value={item.question}
                      onChange={e => setFaq(prev => prev.map((f, j) => j === i ? { ...f, question: e.target.value } : f))}
                      placeholder="¿Tienen garantía?"
                    />
                    <input
                      className={inputClass}
                      value={item.answer}
                      onChange={e => setFaq(prev => prev.map((f, j) => j === i ? { ...f, answer: e.target.value } : f))}
                      placeholder="Sí, 6 meses en motor y transmisión"
                    />
                  </div>
                  <button type="button" onClick={() => setFaq(prev => prev.filter((_, j) => j !== i))} className="mt-1 text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFaq(prev => [...prev, { id: crypto.randomUUID(), question: '', answer: '' }])}
              className="flex items-center gap-1 text-sm text-[#0D7A65] hover:underline"
            >
              <Plus size={14} /> Agregar pregunta
            </button>
          </div>

          {/* ── Slots de Citas ── */}
          <div className="border border-[#E3E6EC] dark:border-[#1A2540] rounded-xl p-4 space-y-3">
            <SectionHeader icon={Calendar} title="Horarios de Citas" desc="El bot ofrecerá estos slots cuando el cliente quiera agendar" />
            <div className="space-y-2">
              {slots.map((slot, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <select
                    className={inputClass + ' flex-1'}
                    value={slot.day}
                    onChange={e => {
                      const day = parseInt(e.target.value)
                      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                      setSlots(prev => prev.map((s, j) => j === i ? { ...s, day, label: `${days[day]} ${s.time}` } : s))
                    }}
                  >
                    {['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'].map((d, idx) => (
                      <option key={idx} value={idx}>{d}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className={inputClass + ' w-32'}
                    value={slot.time}
                    onChange={e => {
                      const time = e.target.value
                      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                      setSlots(prev => prev.map((s, j) => j === i ? { ...s, time, label: `${days[s.day]} ${time}` } : s))
                    }}
                  />
                  <button type="button" onClick={() => setSlots(prev => prev.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setSlots(prev => [...prev, { day: 1, time: '09:00', label: 'Lun 09:00' }])}
              className="flex items-center gap-1 text-sm text-[#0D7A65] hover:underline"
            >
              <Plus size={14} /> Agregar horario
            </button>
          </div>

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
