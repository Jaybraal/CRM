import type { OutreachLanguage } from '@/types'

export interface SeedLead {
  name: string
  email: string
  phone: string
  website?: string
  city: string
  country: string
  specialty: string
  language: OutreachLanguage
  notes?: string
}

/**
 * 13 leads iniciales para STOD, recopilados manualmente de fuentes públicas
 * (sitios propios de las clínicas y directorios: Pladent, Dancefree, CDO).
 * Todos RD → idioma español. discoverySource='manual'.
 *
 * Nota: "CDO" no es una clínica sino el colegio profesional — es un objetivo
 * de ALIANZA (acceso a cientos de odontólogos), no de venta directa. Marcado
 * en notes para que el mensaje se adapte a mano.
 */
export const STOD_SEED_LEADS: SeedLead[] = [
  { name: 'AmeriDent', email: 'info@amerident.com.do', phone: '+18092277979', website: 'amerident.com.do', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'CEDENSA', email: 'info@cedensa.com.do', phone: '+18096875224', website: 'cedensa.com.do', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Clínica Dental Dra. Tactuk', email: 'info@dratactuk.com', phone: '+18095348118', website: 'dratactuk.com', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Clínica Dental Radent', email: 'dra.ramirezvc@gmail.com', phone: '+18297973576', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Dental Care Belledent', email: 'dentalcarebelledent@gmail.com', phone: '+18095470579', city: 'Santo Domingo Este', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Dental Global', email: 'info@dentalglobal.com.do', phone: '+18095374857', website: 'dentalglobal.com.do', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Hamada Dental Clinic', email: 'hamadadentalclinicrd@gmail.com', phone: '+18095422193', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Jose Alonso DDS', email: 'info@josealonsodds.com', phone: '+18006034235', website: 'josealonsodds.com', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Odontología Dominicana (ODONTO-DOM)', email: 'odontodom.mercadeo@gmail.com', phone: '+18095935089', city: 'Santo Domingo', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Dentisalud', email: 'info@dentisalud.com.do', phone: '+18092263494', website: 'dentisalud.com.do', city: 'Santiago', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Dr. Santiago Pichardo', email: 'santiagoepichardo@hotmail.com', phone: '+18095823934', website: 'drsantiagopichardo.com', city: 'Santiago', country: 'RD', specialty: 'Odontología', language: 'es' },
  { name: 'Pladent (red de clínicas)', email: 'info@pladent.com.do', phone: '+18094120269', website: 'pladent.com.do', city: 'Nacional', country: 'RD', specialty: 'Odontología', language: 'es', notes: 'Red con +25 sucursales — objetivo de mayor valor.' },
  { name: 'Colegio Dominicano de Odontólogos (CDO)', email: 'COLEGIODOMINICANODEODONTOLOGOS@hotmail.com', phone: '+18095340880', website: 'cdo.org.do', city: 'Nacional', country: 'RD', specialty: 'Colegio profesional', language: 'es', notes: 'ALIANZA, no venta directa: acceso a cientos de odontólogos colegiados. Personalizar el mensaje a mano.' },
]
