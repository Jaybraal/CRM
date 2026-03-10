'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { updateDoc, doc } from 'firebase/firestore'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { db, auth } from '@/lib/firebase'
import { User, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

const inputClass = 'w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 focus:outline-none focus:border-gray-500'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

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
    } catch {
      toast.error('Error al guardar')
    } finally {
      setSavingName(false)
    }
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
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        toast.error('Contraseña actual incorrecta')
      } else {
        toast.error('Error al cambiar contraseña')
      }
    } finally {
      setSavingPass(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mi perfil</h1>
        <p className="text-gray-500 text-sm mt-1">{profile?.email}</p>
      </div>

      {/* Avatar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex items-center gap-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-2xl font-bold text-gray-600">
          {profile?.displayName?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{profile?.displayName}</p>
          <p className="text-sm text-gray-500 capitalize">{profile?.role?.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Nombre */}
      <form onSubmit={handleSaveName} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <User size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Información personal</h2>
        </div>
        <div>
          <label className={labelClass}>Nombre completo</label>
          <input value={name} onChange={e => setName(e.target.value)} className={inputClass} />
        </div>
        <button type="submit" disabled={savingName || !name.trim()}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {savingName ? 'Guardando...' : 'Guardar nombre'}
        </button>
      </form>

      {/* Contraseña */}
      <form onSubmit={handleChangePassword} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Lock size={18} className="text-gray-500" />
          <h2 className="font-semibold text-gray-900">Cambiar contraseña</h2>
        </div>
        <div>
          <label className={labelClass}>Contraseña actual</label>
          <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
            className={inputClass} placeholder="Tu contraseña actual" />
        </div>
        <div>
          <label className={labelClass}>Nueva contraseña</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
            className={inputClass} placeholder="Mínimo 6 caracteres" />
        </div>
        <div>
          <label className={labelClass}>Confirmar nueva contraseña</label>
          <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            className={inputClass} placeholder="Repite la nueva contraseña" />
        </div>
        <button type="submit" disabled={savingPass || !currentPassword || !newPassword || !confirmPassword}
          className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors">
          {savingPass ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}
