'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getOrganization } from '@/lib/firestore'
import { getBusinessConfig, type BusinessConfig } from '@/lib/businessConfig'

export function useBusinessConfig(): BusinessConfig {
  const { profile } = useAuth()
  const [config, setConfig] = useState<BusinessConfig>(getBusinessConfig('otro'))

  useEffect(() => {
    if (!profile?.orgId) return
    getOrganization(profile.orgId)
      .then(org => {
        if (org?.settings?.industry) setConfig(getBusinessConfig(org.settings.industry))
      })
      .catch(() => {})
  }, [profile?.orgId])

  return config
}
