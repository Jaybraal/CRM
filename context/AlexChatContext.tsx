'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type AlexChatContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const AlexChatContext = createContext<AlexChatContextValue | undefined>(undefined)

// Estado compartido del chat del asistente Alex. Permite abrirlo desde el icono
// del menú lateral (Sidebar) en vez de un botón flotante. El panel vive en
// <ChatAssistant/> y el disparador en <Sidebar/>; ambos comparten este contexto.
export function AlexChatProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const toggle = useCallback(() => setOpen(o => !o), [])
  return (
    <AlexChatContext.Provider value={{ open, setOpen, toggle }}>
      {children}
    </AlexChatContext.Provider>
  )
}

export function useAlexChat() {
  const ctx = useContext(AlexChatContext)
  if (!ctx) throw new Error('useAlexChat debe usarse dentro de <AlexChatProvider>')
  return ctx
}
