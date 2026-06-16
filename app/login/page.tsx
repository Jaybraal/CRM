'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { inputClass, labelClass } from '@/components/ui/primitives'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.replace('/dashboard')
    } catch {
      toast.error('Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7] p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-10 h-10 bg-[#0C1224] flex items-center justify-center mx-auto mb-5">
            <span className="text-white font-bold text-sm tracking-[0.2em] select-none">NX</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0C1224] tracking-tight">NEXO CRM</h1>
          <p className="text-[#68748D] mt-1 text-sm">Accede a tu cuenta</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E3E6EC] rounded-lg p-7">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={labelClass}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="tu@empresa.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0C1224] hover:bg-[#1B2B4B] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded text-sm transition-colors mt-1"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#9BA5B7] text-[11px] mt-6 tracking-wide">
          NEXO CRM — Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
