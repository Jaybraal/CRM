'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateDoc, doc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { User, Lock, Shield } from 'lucide-react'
import toast from 'react-hot-toast'

const inputClass = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-sm transition-colors'
const labelClass = 'block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5'

export default function ProfilePage() {
  const { profile } = useAuth()
  const [name, setName] = useState(profile?.displayName || '')
  const [savingName, setSavingName] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPass, setSavingPass] = useState(false)

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.uid || !name.trim()) return
    setSavingName(true)
    try {
      await updateDoc(doc(db, 'users', profile.uid), { displayName: name.trim() })
      toast.success('Nombre actualizado')
    } catch { toast.error('Error al guardar') }
    finally { setSavingName(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Las contraseñas no coinciden'); return }
    if (newPassword.length < 6) { toast.error('Mínimo 6 caracteres'); return }
    const user = auth.currentUser
    if (!user || !profile?.email) return
    setSavingPass(true)
    try {
      const credential = EmailAuthProvider.credential(profile.email, currentPassword)
      await reauthenticateWithCredential(user, credential)
      await updatePassword(user, newPassword)
      toast.success('Contraseña actualizada')
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch { toast.error('Contraseña actual incorrecta') }
    finally { setSavingPass(false) }
  }

  const initials = profile?.displayName?.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() || 'U'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">Mi Perfil</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gestiona tu información personal</p>
      </div>

      {/* Avatar card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex items-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg">
          {initials}
        </div>
        <div>
          <p className="font-black text-slate-900 dark:text-white text-lg">{profile?.displayName}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{profile?.email}</p>
          <span className="inline-block mt-1 text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold capitalize">
            {profile?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Name */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl"><User size={16} className="text-blue-600" /></div>
          <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Información personal</h2>
        </div>
        <form onSubmit={handleSaveName} className="space-y-4">
          <div>
            <label className={labelClass}>Nombre completo</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} placeholder="Tu nombre" />
          </div>
          <div>
            <label className={labelClass}>Correo electrónico</label>
            <input value={profile?.email || ''} disabled className={`${inputClass} opacity-50 cursor-not-allowed`} />
          </div>
          <button type="submit" disabled={savingName || !name.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
            {savingName ? 'Guardando...' : 'Guardar nombre'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-xl"><Lock size={16} className="text-purple-600" /></div>
          <h2 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Cambiar contraseña</h2>
        </div>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className={labelClass}>Contraseña actual</label>
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} placeholder="••••••••" required />
          </div>
          <div>
            <label className={labelClass}>Nueva contraseña</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} placeholder="Mínimo 6 caracteres" required minLength={6} />
          </div>
          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} placeholder="••••••••" required />
          </div>
          <button type="submit" disabled={savingPass} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl transition-colors">
            {savingPass ? 'Actualizando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>

      {/* Role info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-5 flex items-center gap-3">
        <Shield size={18} className="text-blue-600 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
          Tu rol es <strong className="font-black capitalize">{profile?.role?.replace('_', ' ')}</strong>. Contacta a un administrador para cambiar permisos.
        </p>
      </div>
    </div>
  )
}
