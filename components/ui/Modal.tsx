'use client'

import { X } from 'lucide-react'
import { useEffect } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  variant?: 'light' | 'dark'
}

export default function Modal({ open, onClose, title, children, footer, size = 'md', variant = 'light' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const sizeClass = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size]
  const isDark = variant === 'dark'

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/60 backdrop-blur-sm">
      <div className={`w-full ${sizeClass} border rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92svh] sm:max-h-[90vh] ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700'}`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-100 dark:border-slate-800'}`}>
          <h2 className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{title}</h2>
          <button onClick={onClose} className={`p-1.5 rounded-xl transition-colors ${isDark ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className={`px-6 py-4 border-t shrink-0 ${isDark ? 'border-slate-700' : 'border-slate-100 dark:border-slate-800'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
