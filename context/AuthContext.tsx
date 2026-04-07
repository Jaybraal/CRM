'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/firestore'
import type { AppUser } from '@/types'
import toast from 'react-hot-toast'

const ACTIVE_ORG_KEY = 'superadmin_active_org'

interface AuthContextType {
  user: User | null
  profile: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
  isSuperAdmin: boolean
  isOwner: boolean
  isManager: boolean
  isSupervisor: boolean
  isAgent: boolean
  switchOrg: (orgId: string) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isSuperAdmin: false,
  isOwner: false,
  isManager: false,
  isSupervisor: false,
  isAgent: false,
  switchOrg: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const superAdminUid = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const isSA = firebaseUser.uid === superAdminUid

        // Reintentar hasta 3 veces con backoff si Firestore falla (red lenta, adblocker, etc.)
        let p = null
        let fetchError = false
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            p = await getUserProfile(firebaseUser.uid)
            fetchError = false
            break
          } catch {
            fetchError = true
            if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          }
        }

        if (p) {
          if (isSA) {
            const activeOrg = sessionStorage.getItem(ACTIVE_ORG_KEY)
            setProfile({ ...p, role: 'super_admin', orgId: activeOrg || p.orgId })
          } else {
            setProfile(p)
          }
        } else if (isSA) {
          const activeOrg = sessionStorage.getItem(ACTIVE_ORG_KEY)
          setProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Admin',
            role: 'super_admin',
            orgId: activeOrg || null,
            createdAt: new Date(),
          })
        } else if (fetchError) {
          // Error de red/permisos al leer Firestore — no cerrar sesión, mostrar aviso
          toast.error('Error al cargar tu perfil. Verifica tu conexión e intenta de nuevo.', { duration: 6000 })
          await firebaseSignOut(auth)
          setProfile(null)
        } else {
          // Documento no existe en Firestore — usuario sin perfil configurado
          toast.error('Tu cuenta no tiene perfil asignado. Contacta al administrador.', { duration: 8000 })
          await firebaseSignOut(auth)
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [superAdminUid])

  const signOut = async () => {
    sessionStorage.removeItem(ACTIVE_ORG_KEY)
    await firebaseSignOut(auth)
    setProfile(null)
  }

  const switchOrg = (orgId: string) => {
    sessionStorage.setItem(ACTIVE_ORG_KEY, orgId)
    setProfile(prev => prev ? { ...prev, orgId } : prev)
  }

  const role = profile?.role

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signOut,
      isSuperAdmin: user?.uid === superAdminUid || role === 'super_admin',
      isOwner: role === 'owner' || role === 'super_admin',
      isManager: role === 'manager' || role === 'owner' || role === 'super_admin',
      isSupervisor: role === 'supervisor' || role === 'manager' || role === 'owner' || role === 'super_admin',
      isAgent: !!role,
      switchOrg,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
