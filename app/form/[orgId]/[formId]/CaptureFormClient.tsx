'use client'

import { useEffect, useState } from 'react'
import type { CaptureForm } from '@/types'

export default function CaptureFormClient({ orgId, formId }: { orgId: string; formId: string }) {
  const [form, setForm] = useState<CaptureForm | null>(null)
  const [loading, setLoading] = useState(true)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/forms/${orgId}/${formId}`)
      .then(r => r.json())
      .then(d => { if (d.form) setForm(d.form); else setError('Formulario no encontrado') })
      .catch(() => setError('Error al cargar el formulario'))
      .finally(() => setLoading(false))
  }, [orgId, formId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forms/${orgId}/${formId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al enviar')
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    </div>
  )

  if (!form || !form.active) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-gray-500 text-sm">Este formulario no está disponible</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-md w-full text-center shadow-sm">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">¡Enviado!</h2>
        <p className="text-gray-500 text-sm">{form.confirmationMessage}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 max-w-lg w-full shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{form.name}</h1>
        <p className="text-gray-400 text-sm mb-6">Completa los datos y nos pondremos en contacto</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {form.fields.map(field => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea required={field.required} value={values[field.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500 resize-none" />
              ) : (
                <input type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                  required={field.required} value={values[field.id] || ''}
                  onChange={e => setValues(v => ({ ...v, [field.id]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-gray-500" />
              )}
            </div>
          ))}

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button type="submit" disabled={submitting}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors mt-2">
            {submitting ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  )
}
