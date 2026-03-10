'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/firestore'
import type { AppUser } from '@/types'

interface AuthContextType {
  user: User | null
  profile: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
  isSuperAdmin: boolean
  isOwner: boolean
  isManager: boolean
  isAgent: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  isSuperAdmin: false,
  isOwner: false,
  isManager: false,
  isAgent: false,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const superAdminUid = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const p = await getUserProfile(firebaseUser.uid)
          if (p) {
            setProfile(p)
          } else if (firebaseUser.uid === superAdminUid) {
            // Fallback para Super Admin si Firestore no responde
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Admin',
              role: 'super_admin',
              orgId: null,
              createdAt: new Date(),
            })
          } else {
            setProfile(null)
          }
        } catch {
          if (firebaseUser.uid === superAdminUid) {
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Admin',
              role: 'super_admin',
              orgId: null,
              createdAt: new Date(),
            })
          } else {
            setProfile(null)
          }
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signOut = async () => {
    await firebaseSignOut(auth)
    setProfile(null)
  }

  const role = profile?.role
  const superAdminUid = process.env.NEXT_PUBLIC_SUPER_ADMIN_UID

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signOut,
      isSuperAdmin: user?.uid === superAdminUid || role === 'super_admin',
      isOwner: role === 'owner' || role === 'super_admin',
      isManager: role === 'manager' || role === 'owner' || role === 'super_admin',
      isAgent: !!role,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
