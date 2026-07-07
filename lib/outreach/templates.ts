import type { OutreachLanguage } from '@/types'

export type OutreachStep = 0 | 5 | 10 | 20

export interface OutreachTemplate {
  subject: string
  /** Cuerpo con placeholders {{clinicName}} y {{observation}}. */
  body: string
}

/**
 * Plantillas de la secuencia de outreach de STOD, por idioma y paso.
 * Ángulo respaldado por investigación de mercado: no-shows del 12-30% y
 * recepcionistas gastando ~4h/día confirmando citas por teléfono.
 *
 * Placeholders:
 *   {{clinicName}}   — nombre de la clínica
 *   {{observation}}  — observación concreta (enrichment). Puede quedar vacío.
 */
const TEMPLATES: Record<OutreachLanguage, Record<OutreachStep, OutreachTemplate>> = {
  es: {
    0: {
      subject: 'Menos citas perdidas en {{clinicName}}',
      body: `Hola, equipo de {{clinicName}}:

Estuve revisando cómo gestionan las citas.{{observation}} Muchas clínicas dentales pierden entre un 12% y un 30% de sus citas por inasistencias, y una recepcionista puede dedicar hasta 4 horas al día solo a confirmar por teléfono.

Desarrollamos STOD, un sistema para clínicas dentales que gestiona agenda, historial y pagos, con recordatorios automáticos y un asistente que atiende y agenda 24/7 por WhatsApp. Reduce las inasistencias y libera a tu equipo de las llamadas.

¿Te vendría bien una demostración de 15 minutos esta semana?

Un saludo,
Marck`,
    },
    5: {
      subject: 'Re: Menos citas perdidas en {{clinicName}}',
      body: `Hola de nuevo:

Solo para retomar mi correo anterior. Sé que el día a día en la clínica no da tregua — por eso justamente STOD se encarga de recordar las citas y agendar solo.

Si me dices un día, coordino una demo corta adaptada a {{clinicName}}.

Un saludo,
Marck`,
    },
    10: {
      subject: 'Cómo una clínica recuperó horas de recepción',
      body: `Hola:

Un caso concreto: clínicas que activan recordatorios automáticos bajan sus inasistencias del 20% al 8% en unas semanas, y la recepción deja de perder horas llamando una por una.

STOD hace eso y además centraliza pacientes, historial y cobros en un solo lugar, disponible en cualquier dispositivo.

¿Lo vemos en 15 minutos?

Un saludo,
Marck`,
    },
    20: {
      subject: 'Cierro el tema por ahora',
      body: `Hola:

No quiero insistir de más. Cierro este hilo por ahora, pero si en algún momento quieren reducir las citas perdidas y el trabajo manual de la recepción en {{clinicName}}, aquí estaré.

Les dejo mi contacto para cuando sea buen momento.

Un saludo,
Marck`,
    },
  },
  en: {
    0: {
      subject: 'Fewer missed appointments at {{clinicName}}',
      body: `Hello {{clinicName}} team,

I was looking at how you handle appointments.{{observation}} Many dental clinics lose between 12% and 30% of their appointments to no-shows, and a receptionist can spend up to 4 hours a day just confirming them by phone.

We built STOD, a system for dental clinics that manages scheduling, records and payments, with automatic reminders and an assistant that answers and books 24/7 over WhatsApp. It cuts no-shows and frees your team from the calls.

Would a 15-minute demo this week work for you?

Best,
Marck`,
    },
    5: {
      subject: 'Re: Fewer missed appointments at {{clinicName}}',
      body: `Hi again,

Just following up on my previous note. I know clinic days are relentless — that's exactly why STOD handles the reminders and booking for you.

Tell me a day and I'll set up a short demo tailored to {{clinicName}}.

Best,
Marck`,
    },
    10: {
      subject: 'How one clinic got its front-desk hours back',
      body: `Hi,

A concrete example: clinics that turn on automatic reminders drop no-shows from 20% to 8% within weeks, and the front desk stops losing hours calling one by one.

STOD does that and also centralizes patients, records and payments in one place, on any device.

Shall we look at it in 15 minutes?

Best,
Marck`,
    },
    20: {
      subject: 'Closing the loop for now',
      body: `Hi,

I don't want to over-follow-up. I'll close this thread for now, but whenever you want to reduce missed appointments and manual front-desk work at {{clinicName}}, I'm here.

Leaving my contact for when the timing is right.

Best,
Marck`,
    },
  },
  de: {
    0: {
      subject: 'Weniger verpasste Termine bei {{clinicName}}',
      body: `Hallo Team von {{clinicName}},

ich habe mir angesehen, wie Sie Termine verwalten.{{observation}} Viele Zahnkliniken verlieren zwischen 12% und 30% ihrer Termine durch Nichterscheinen, und eine Rezeptionskraft kann bis zu 4 Stunden am Tag allein mit telefonischer Bestätigung verbringen.

Wir haben STOD entwickelt, ein System für Zahnkliniken, das Terminplanung, Patientenakten und Zahlungen verwaltet — mit automatischen Erinnerungen und einem Assistenten, der rund um die Uhr über WhatsApp antwortet und Termine bucht. Das senkt Ausfälle und entlastet Ihr Team von Anrufen.

Würde Ihnen diese Woche eine 15-minütige Demo passen?

Beste Grüße,
Marck`,
    },
    5: {
      subject: 'Re: Weniger verpasste Termine bei {{clinicName}}',
      body: `Hallo nochmal,

nur eine kurze Erinnerung an meine vorherige Nachricht. Ich weiß, der Klinikalltag lässt kaum Luft — genau deshalb übernimmt STOD die Erinnerungen und Buchungen für Sie.

Nennen Sie mir einen Tag, und ich richte eine kurze, auf {{clinicName}} zugeschnittene Demo ein.

Beste Grüße,
Marck`,
    },
    10: {
      subject: 'Wie eine Klinik ihre Rezeptionsstunden zurückgewann',
      body: `Hallo,

ein konkretes Beispiel: Kliniken, die automatische Erinnerungen aktivieren, senken das Nichterscheinen innerhalb von Wochen von 20% auf 8%, und die Rezeption verliert keine Stunden mehr mit Einzelanrufen.

STOD leistet das und bündelt zudem Patienten, Akten und Zahlungen an einem Ort, auf jedem Gerät.

Sollen wir es uns in 15 Minuten ansehen?

Beste Grüße,
Marck`,
    },
    20: {
      subject: 'Ich schließe das Thema vorerst ab',
      body: `Hallo,

ich möchte nicht zu aufdringlich sein. Ich schließe diesen Verlauf vorerst ab — aber wann immer Sie verpasste Termine und manuelle Rezeptionsarbeit bei {{clinicName}} reduzieren möchten, bin ich da.

Ich hinterlasse meinen Kontakt für den richtigen Zeitpunkt.

Beste Grüße,
Marck`,
    },
  },
}

export const OUTREACH_STEPS: OutreachStep[] = [0, 5, 10, 20]

/** Rellena una plantilla con el nombre de la clínica y una observación opcional. */
export function renderTemplate(
  language: OutreachLanguage,
  step: OutreachStep,
  vars: { clinicName: string; observation?: string }
): OutreachTemplate {
  const tpl = TEMPLATES[language][step]
  // La observación se antepone con un espacio para encajar tras "...las citas."
  const observation = vars.observation ? ` ${vars.observation.trim()}` : ''
  const fill = (s: string) =>
    s.replace(/\{\{clinicName\}\}/g, vars.clinicName).replace(/\{\{observation\}\}/g, observation)
  return { subject: fill(tpl.subject), body: fill(tpl.body) }
}
