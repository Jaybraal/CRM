'use client'

import type { ComponentType, ReactNode } from 'react'

/**
 * Primitivos de UI compartidos — una sola fuente de verdad para el diseño del CRM.
 * Antes cada página reinventaba cards, headers, botones y spinners con valores
 * ligeramente distintos. Importar desde aquí mantiene todo consistente y ligero.
 */

type IconType = ComponentType<{ size?: number; className?: string }>

// ── Clases reutilizables para formularios ─────────────────────────────────────
export const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'

export const labelClass =
  'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

// ── Encabezado de página ──────────────────────────────────────────────────────
// Unifica el título/subtítulo de cada pantalla (antes variaban entre text-2xl y 3xl).
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children?: ReactNode // acción a la derecha (botón, etc.)
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white truncate">{title}</h1>
        {subtitle && (
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">{subtitle}</p>
        )}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  )
}

// ── Tarjeta ───────────────────────────────────────────────────────────────────
export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm ${
        padded ? 'p-5' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

// ── Encabezado de sección dentro de una card ─────────────────────────────────
export function SectionHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: IconType
  title: string
  desc?: string
}) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl flex-shrink-0">
        <Icon size={16} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="min-w-0">
        <h2 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h2>
        {desc && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{desc}</p>}
      </div>
    </div>
  )
}

// ── Botón ─────────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20',
  secondary:
    'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
  danger:
    'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20',
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: {
  children: ReactNode
  variant?: ButtonVariant
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

// ── Tarjeta de métrica ────────────────────────────────────────────────────────
export function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  colorClass,
  alert,
}: {
  title: string
  value: string | number
  sub?: string
  icon: IconType
  colorClass: string
  alert?: boolean
}) {
  return (
    <div
      className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all ${
        alert ? 'border-red-200 dark:border-red-900' : 'border-slate-100 dark:border-slate-800'
      }`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colorClass}`}>
          <Icon size={20} />
        </div>
        {alert && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
            Urgente
          </span>
        )}
      </div>
      <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{title}</p>
      <h4 className="text-2xl font-black mt-1 text-slate-900 dark:text-white">{value}</h4>
      {sub && (
        <p className={`text-xs mt-1 truncate ${alert ? 'text-red-500 font-medium' : 'text-slate-400 dark:text-slate-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
        on ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
      }`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-1'}`} />
    </div>
  )
}

// ── Spinner de carga ──────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`}>
      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Estado vacío ──────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: IconType
  title: string
  desc?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl mb-4">
        <Icon size={24} className="text-slate-400" />
      </div>
      <p className="font-bold text-slate-700 dark:text-slate-200">{title}</p>
      {desc && <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 max-w-sm">{desc}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
