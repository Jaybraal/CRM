'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile } from '@/lib/firestore'
import type { AppUser } from '@/types'

const ACTIVE_ORG_KEY = 'superadmin_active_org'

interface AuthContextType {
  user: User | null
  profile: AppUser | null
  loading: boolean
  signOut: () => Promise<void>
  isSuperAdmin: boolean
  isOwner: boolean
  isManager: boolean
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
        try {
          const p = await getUserProfile(firebaseUser.uid)
          if (p) {
            // For super admin, apply active org override if set
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
          } else {
            // No profile in Firestore = not a created user → block access
            await firebaseSignOut(auth)
            setProfile(null)
          }
        } catch {
          if (isSA) {
            const activeOrg = sessionStorage.getItem(ACTIVE_ORG_KEY)
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'Admin',
              role: 'super_admin',
              orgId: activeOrg || null,
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
