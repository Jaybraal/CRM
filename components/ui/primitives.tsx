'use client'

import type { ComponentType, ReactNode } from 'react'

type IconType = ComponentType<{ size?: number; className?: string }>

// ── Formularios ───────────────────────────────────────────────────────────────
export const inputClass =
  'w-full bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded px-3.5 py-2 text-[#0C1224] dark:text-[#E8ECF4] placeholder-[#9BA5B7] focus:outline-none focus:border-[#0D7A65] focus:ring-2 focus:ring-[#0D7A65]/10 text-sm transition-colors'

export const labelClass =
  'block text-[10px] font-semibold text-[#68748D] dark:text-[#7B8BA5] uppercase tracking-wider mb-1.5'

// ── Encabezado de página ──────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#0C1224] dark:text-[#E8ECF4] truncate tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-[#68748D] dark:text-[#7B8BA5] mt-0.5 text-sm">{subtitle}</p>
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
      className={`bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg ${
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
    <div className="flex items-center gap-2.5 pb-4 border-b border-[#E3E6EC] dark:border-[#1A2540]">
      <Icon size={15} className="text-[#68748D] dark:text-[#7B8BA5] flex-shrink-0" />
      <div className="min-w-0">
        <h2 className="text-xs font-semibold text-[#0C1224] dark:text-[#E8ECF4] uppercase tracking-wider">{title}</h2>
        {desc && <p className="text-xs text-[#9BA5B7] dark:text-[#7B8BA5] mt-0.5">{desc}</p>}
      </div>
    </div>
  )
}

// ── Botón ─────────────────────────────────────────────────────────────────────
type ButtonVariant = 'primary' | 'secondary' | 'danger'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[#0C1224] hover:bg-[#1B2B4B] text-white dark:bg-[#0D7A65] dark:hover:bg-[#0B6B57]',
  secondary:
    'bg-white dark:bg-transparent border border-[#E3E6EC] dark:border-[#1A2540] text-[#0C1224] dark:text-[#E8ECF4] hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540]',
  danger:
    'bg-[#DC2626] hover:bg-[#B91C1C] text-white',
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
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-colors disabled:opacity-40 disabled:pointer-events-none ${BUTTON_VARIANTS[variant]} ${className}`}
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
    <div className="relative bg-white dark:bg-[#0F1829] border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg p-5 overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: alert ? '#DC2626' : '#0D7A65' }}
      />
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-semibold text-[#68748D] dark:text-[#7B8BA5] uppercase tracking-wider">{title}</p>
        {alert && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 uppercase tracking-wide">
            Urgente
          </span>
        )}
      </div>
      <h4 className="text-2xl font-semibold font-mono tabular-nums text-[#0C1224] dark:text-[#E8ECF4] leading-none">{value}</h4>
      {sub && (
        <p className={`text-xs mt-1.5 ${alert ? 'text-red-500' : 'text-[#68748D] dark:text-[#7B8BA5]'}`}>{sub}</p>
      )}
      <div className="mt-4">
        <Icon size={14} className="text-[#9BA5B7] dark:text-[#7B8BA5]" />
      </div>
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
        on ? 'bg-[#0D7A65]' : 'bg-[#E3E6EC] dark:bg-[#1A2540]'
      }`}
    >
      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
    </div>
  )
}

// ── Spinner de carga ──────────────────────────────────────────────────────────
export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`flex justify-center py-16 ${className}`}>
      <div className="w-7 h-7 border-2 border-[#E3E6EC] border-t-[#0D7A65] rounded-full animate-spin" />
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
      <div className="w-10 h-10 flex items-center justify-center mb-4 border border-[#E3E6EC] dark:border-[#1A2540] rounded-lg">
        <Icon size={18} className="text-[#9BA5B7]" />
      </div>
      <p className="font-semibold text-[#0C1224] dark:text-[#E8ECF4] text-sm">{title}</p>
      {desc && <p className="text-sm text-[#68748D] dark:text-[#7B8BA5] mt-1 max-w-sm">{desc}</p>}
      {children && <div className="mt-5">{children}</div>}
    </div>
  )
}
