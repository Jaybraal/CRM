'use client'

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { QrCode, X, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

interface Props {
  phone: string
  clientName: string
}

export default function WhatsAppQR({ phone, clientName }: Props) {
  const [open, setOpen] = useState(false)

  const clean = phone.replace(/[^0-9]/g, '')
  const waUrl = `https://wa.me/${clean}`

  const copyLink = () => {
    navigator.clipboard.writeText(waUrl)
    toast.success('Enlace copiado')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold transition-colors"
        title="Ver QR de WhatsApp"
      >
        <QrCode size={14} />
        QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-xs p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-900 dark:text-white text-sm">WhatsApp QR</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{clientName}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* QR */}
            <div className="flex justify-center">
              <div className="p-4 bg-white border-2 border-slate-100 dark:border-slate-700 rounded-xl">
                <QRCodeSVG
                  value={waUrl}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                  imageSettings={{
                    src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzI1RDM2NiIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0uNSAxNS41aC0uMDFjLTEuNzUgMC0zLjQ3LS40Ni00Ljk3LTEuMzNsLTMuNSAxLjA3IDEuMDktMy40MkM0LjA0IDE0LjA2IDMuNSAxMi41OSAzLjUgMTFjMC00LjEzIDMuMzctNy41IDcuNS03LjVzNy41IDMuMzcgNy41IDcuNS0zLjM3IDcuNS03LjUgNy41em00LjEzLTUuNDdjLS4yMy0uMTItMS4zNi0uNjctMS41Ny0uNzVzLS4zNi0uMTItLjUxLjEyYy0uMTUuMjMtLjU4LjczLS43MS44OHMtLjI2LjE4LS40OS4wNmMtMS41Mi0uNzYtMi41Mi0xLjM2LTMuNTItMy4wOC0uMjctLjQ2LjI3LS40My43Ny0xLjQzLjA4LS4xNy4wNC0uMzItLjAyLS40NHMtLjUxLTEuMjMtLjctMS42OGMtLjE4LS40My0uMzctLjM3LS41MS0uMzhoLS40NGMtLjE1IDAtLjM4LjA2LS41OC4yNy0uMi4yMi0uNzYuNzQtLjc2IDEuOHMuNzggMi4wOC44OSAyLjIyYzEuMTIgMS40MiAyLjQgMi42NiA0LjE1IDMuMzZhNiA2IDAgMCAwIDIuMy41MWMuMjQgMCAuNDctLjAyLjY5LS4wNi41LS4wOS45NC0uNDcgMS4yMi0uODcuMjQtLjM2LjI0LS43LjE3LS44NXoiLz48L3N2Zz4=",
                    height: 32,
                    width: 32,
                    excavate: true,
                  }}
                />
              </div>
            </div>

            {/* Phone */}
            <p className="text-center text-sm font-bold text-slate-700 dark:text-slate-300">{phone}</p>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={copyLink}
                className="flex items-center justify-center gap-1.5 py-2.5 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
              >
                <Copy size={13} /> Copiar enlace
              </button>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-xl text-xs font-bold transition-colors"
              >
                <ExternalLink size={13} /> Abrir WA
              </a>
            </div>

            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              Escanea con cualquier cámara para abrir el chat
            </p>
          </div>
        </div>
      )}
    </>
  )
}
