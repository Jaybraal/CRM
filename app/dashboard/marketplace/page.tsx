'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, updateOrganization } from '@/lib/firestore'
import type { Organization } from '@/types'
import {
  Check, ChevronRight, Zap, RefreshCw, AlertCircle,
  Star, ArrowRight
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Blueprint {
  id: string
  name: string
  description: string
  icon: string
  color: string
  industry: string
  pipelineStages: string[]
  tags: string[]
  aiPromptHint: string
  popular?: boolean
}

const BLUEPRINTS: Blueprint[] = [
  {
    id: 'inmobiliaria',
    name: 'Inmobiliaria Premium',
    description: 'Gestión de propiedades, seguimiento de leads calificados y agendamiento de visitas con IA.',
    icon: '🏢',
    color: 'bg-[#0C1224]',
    industry: 'inmobiliaria',
    pipelineStages: ['Nuevo Lead', 'Visita Agendada', 'Propuesta', 'Negociación', 'Escritura', 'Cerrado'],
    tags: ['Propietario', 'Arrendador', 'Inversionista', 'Primera vivienda'],
    aiPromptHint: 'Eres un asesor inmobiliario. Califica leads preguntando por presupuesto, zona de interés y si es para compra o alquiler.',
    popular: true,
  },
  {
    id: 'taller',
    name: 'Taller Automotriz',
    description: 'Citas de servicio, recordatorios de entrega y cotización de repuestos automática.',
    icon: '🚗',
    color: 'bg-red-500',
    industry: 'automotriz',
    pipelineStages: ['Cita Solicitada', 'Vehículo Recibido', 'En Diagnóstico', 'Cotización Enviada', 'En Reparación', 'Listo para Entrega', 'Cerrado'],
    tags: ['Cliente frecuente', 'Garantía activa', 'Presupuesto aprobado', 'Espera repuesto'],
    aiPromptHint: 'Eres recepcionista de un taller mecánico. Agenda citas, da información de servicios y cotiza según el catálogo.',
    popular: true,
  },
  {
    id: 'clinica',
    name: 'Clínica / Salud',
    description: 'Gestión de pacientes, triage básico con IA y recordatorios de citas médicas.',
    icon: '⚕️',
    color: 'bg-teal-500',
    industry: 'salud',
    pipelineStages: ['Consulta Inicial', 'Cita Agendada', 'En Tratamiento', 'Seguimiento', 'Alta'],
    tags: ['Paciente nuevo', 'Control', 'Urgencia', 'Seguro médico'],
    aiPromptHint: 'Eres asistente de una clínica. Agenda citas, explica servicios y orienta al paciente sin dar diagnósticos médicos.',
  },
  {
    id: 'agencia',
    name: 'Agencia de Marketing',
    description: 'Calificación de leads B2B, propuestas comerciales y seguimiento de proyectos.',
    icon: '📈',
    color: 'bg-purple-600',
    industry: 'servicios',
    pipelineStages: ['Lead Entrante', 'Reunión de Discovery', 'Propuesta Enviada', 'Negociación', 'Onboarding', 'Proyecto Activo'],
    tags: ['PYME', 'Empresa mediana', 'E-commerce', 'Marca personal'],
    aiPromptHint: 'Eres consultor de marketing digital. Califica si el lead es una empresa con presupuesto de marketing activo.',
  },
  {
    id: 'restaurante',
    name: 'Restaurante / Delivery',
    description: 'Toma de pedidos por WhatsApp, menú dinámico y respuesta automática a FAQs.',
    icon: '🍔',
    color: 'bg-amber-500',
    industry: 'restaurante',
    pipelineStages: ['Pedido Recibido', 'En Preparación', 'Listo', 'En Camino', 'Entregado'],
    tags: ['Delivery', 'Para llevar', 'Reserva', 'Evento'],
    aiPromptHint: 'Eres el asistente del restaurante. Recibe pedidos, informa el menú del día y confirma domicilios.',
  },
  {
    id: 'ecommerce',
    name: 'E-commerce / Retail',
    description: 'Seguimiento de compras, resolución de dudas de envío y recuperación de carritos.',
    icon: '🛍️',
    color: 'bg-[#0C1224]',
    industry: 'ecommerce',
    pipelineStages: ['Interés', 'Cotizó', 'Carrito Abandonado', 'Pedido Confirmado', 'Enviado', 'Entregado', 'Post-venta'],
    tags: ['Nuevo cliente', 'Recurrente', 'VIP', 'Referido'],
    aiPromptHint: 'Eres asistente de tienda online. Resuelve dudas sobre productos, stock, envíos y guía la compra.',
  },
  {
    id: 'educacion',
    name: 'Centro Educativo',
    description: 'Inscripciones, información de cursos, seguimiento de prospectos y recordatorios de clases.',
    icon: '🎓',
    color: 'bg-sky-600',
    industry: 'educacion',
    pipelineStages: ['Prospecto Interesado', 'Info Enviada', 'Visita / Demo', 'Inscripción', 'Estudiante Activo'],
    tags: ['Estudiante', 'Padre/Madre', 'Empresa (B2B)', 'Beca'],
    aiPromptHint: 'Eres asesor académico. Informa sobre programas, costos y agenda demos o tours de las instalaciones.',
  },
  {
    id: 'generico',
    name: 'Negocio Genérico',
    description: 'Emudo de ventas estándar, ideal para servicios generales o retail sin categoría específica.',
    icon: '📦',
    color: 'bg-slate-600',
    industry: 'otro',
    pipelineStages: ['Lead', 'Contactado', 'Propuesta', 'Negociación', 'Cerrado Ganado', 'Cerrado Perdido'],
    tags: ['Lead frío', 'Lead caliente', 'Cliente actual', 'Referido'],
    aiPromptHint: 'Eres asistente de ventas. Califica leads, responde preguntas sobre el negocio y agenda reuniones.',
  },
]

export default function MarketplacePage() {
  const { profile } = useAuth()
  const [org, setOrg] = useState<Organization | null>(null)
  const [installing, setInstalling] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.orgId) return
    getOrganization(profile.orgId)
      .then(setOrg)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile?.orgId])

  const currentIndustry = org?.settings?.industry

  async function installBlueprint(bp: Blueprint) {
    if (!profile?.orgId || !org) return
    setInstalling(bp.id)
    try {
      await updateOrganization(profile.orgId, {
        settings: {
          ...org.settings,
          industry: bp.industry,
          pipelineStages: bp.pipelineStages.map((name, i) => ({
            id: `stage_${i}`,
            name,
            order: i,
            color: ['#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#10b981','#ef4444','#6366f1'][i % 7],
          })),
        },
      })
      setOrg(prev => prev ? {
        ...prev,
        settings: {
          ...prev.settings,
          industry: bp.industry,
        }
      } : prev)
      toast.success(`Blueprint "${bp.name}" instalado correctamente`)
    } catch {
      toast.error('Error al instalar el blueprint')
    } finally {
      setInstalling(null)
    }
  }

  const installedBp = BLUEPRINTS.find(bp => bp.industry === currentIndustry)

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-[#0C1224] rounded-md flex items-center justify-center shadow-lg">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0C1224] dark:text-[#E8ECF4]">Marketplace de Blueprints</h1>
            <p className="text-[#68748D] dark:text-[#9BA5B7] text-sm">Configura tu CRM para tu industria en un solo clic</p>
          </div>
        </div>

        {installedBp && (
          <div className="mt-4 flex items-center gap-3 bg-[#F4F5F7] dark:bg-[#0D7A65]/10 border border-blue-200 dark:border-blue-800 rounded-md px-4 py-3">
            <div className={`${installedBp.color} w-10 h-10 rounded-md flex items-center justify-center text-xl shadow-sm flex-shrink-0`}>
              {installedBp.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
                Blueprint activo: {installedBp.name}
              </p>
              <p className="text-xs text-[#0D7A65] dark:text-[#0D7A65]">
                Pipeline con {installedBp.pipelineStages.length} etapas · IA configurada para {installedBp.industry}
              </p>
            </div>
            <Check size={18} className="text-[#0D7A65] flex-shrink-0" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 gap-3 text-[#9BA5B7]">
          <RefreshCw size={20} className="animate-spin" />
          <span>Cargando blueprints...</span>
        </div>
      ) : (
        <>
          {/* Blueprints grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {BLUEPRINTS.map(bp => {
              const isInstalled = bp.industry === currentIndustry
              const isLoading = installing === bp.id
              return (
                <div
                  key={bp.id}
                  className={`relative bg-white dark:bg-[#1A2540] rounded-lg border-2 transition-all overflow-hidden flex flex-col ${
                    isInstalled
                      ? 'border-[#0D7A65] shadow-lg shadow-blue-500/10'
                      : 'border-[#E3E6EC] dark:border-[#1A2540] hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
                  }`}
                >
                  {bp.popular && !isInstalled && (
                    <div className="absolute top-3 right-3 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Star size={9} fill="currentColor" /> Popular
                    </div>
                  )}
                  {isInstalled && (
                    <div className="absolute top-3 right-3 bg-[#0D7A65]/10 dark:bg-[#0D7A65]/10 text-blue-700 dark:text-[#0D7A65] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={9} /> Activo
                    </div>
                  )}

                  {/* Top color band */}
                  <div className={`${bp.color} h-1.5 w-full`} />

                  <div className="p-5 flex flex-col flex-1">
                    <div className={`${bp.color} w-12 h-12 rounded-md flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                      {bp.icon}
                    </div>
                    <h3 className="font-bold text-[#0C1224] dark:text-[#E8ECF4] text-sm mb-1">{bp.name}</h3>
                    <p className="text-xs text-[#68748D] dark:text-[#9BA5B7] leading-relaxed flex-1 mb-4">
                      {bp.description}
                    </p>

                    {/* Pipeline preview */}
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-[#9BA5B7] uppercase tracking-wider mb-1.5">Pipeline</p>
                      <div className="flex flex-wrap gap-1">
                        {bp.pipelineStages.slice(0, 3).map(s => (
                          <span key={s} className="text-[10px] bg-[#F4F5F7] dark:bg-[#1A2540] text-[#68748D] dark:text-[#9BA5B7] px-1.5 py-0.5 rounded font-medium">
                            {s}
                          </span>
                        ))}
                        {bp.pipelineStages.length > 3 && (
                          <span className="text-[10px] text-[#9BA5B7]">+{bp.pipelineStages.length - 3}</span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => !isInstalled && installBlueprint(bp)}
                      disabled={isInstalled || isLoading}
                      className={`w-full py-2.5 rounded-md font-bold text-sm flex justify-center items-center gap-2 transition-all ${
                        isInstalled
                          ? 'bg-[#F4F5F7] dark:bg-[#1A2540] text-[#9BA5B7] cursor-not-allowed'
                          : isLoading
                          ? 'bg-[#0D7A65]/10 dark:bg-[#0D7A65]/10 text-[#0D7A65] cursor-wait'
                          : 'bg-[#F4F5F7] dark:bg-[#0D7A65]/10 text-blue-700 dark:text-[#0D7A65] hover:bg-[#0C1224] hover:text-white dark:hover:bg-[#0C1224] dark:hover:text-white'
                      }`}
                    >
                      {isInstalled ? (
                        <><Check size={15} /> Instalado</>
                      ) : isLoading ? (
                        <><RefreshCw size={15} className="animate-spin" /> Instalando...</>
                      ) : (
                        <>Instalar Blueprint <ChevronRight size={15} /></>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Info section */}
          <div className="mt-8 p-5 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-4">
            <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">
                ¿Qué hace un Blueprint al instalarse?
              </p>
              <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <li className="flex items-center gap-2"><ArrowRight size={10} /> Configura las etapas del Pipeline (Kanban) para tu industria</li>
                <li className="flex items-center gap-2"><ArrowRight size={10} /> Ajusta el comportamiento del Asistente IA (Alex) según el sector</li>
                <li className="flex items-center gap-2"><ArrowRight size={10} /> Establece las etiquetas de clientes más comunes en tu negocio</li>
                <li className="flex items-center gap-2"><ArrowRight size={10} /> Los contactos y chats existentes no se modifican</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
