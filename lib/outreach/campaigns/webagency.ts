import type { OutreachLanguage } from '@/types'
import type { OutreachStep, OutreachTemplate } from '../templates'

/**
 * Campaña "Agencia — Sitios Web": vender construcción de tiendas online
 * profesionales a negocios con producto físico, usando Aura (la tienda de
 * perfumería) como portafolio/prueba. Enviada desde el mismo Gmail de
 * Agencia que STOD, pero con copy y remitente propios.
 *
 * PENDIENTE: el enlace a Aura queda marcado como placeholder hasta que se
 * publique en internet — no inventar un link que no funcione.
 */
export const WEBAGENCY_TEMPLATES: Partial<Record<OutreachLanguage, Partial<Record<OutreachStep, OutreachTemplate>>>> = {
  es: {
    0: {
      subject: 'Una tienda online profesional para {{clinicName}}',
      body: `Hola, equipo de {{clinicName}}:

Estuve viendo el negocio y noté que la presencia online podría ser más fuerte.{{observation}}

Somos una agencia que construye tiendas online profesionales para negocios con producto físico. Como referencia, así se ve una que hicimos: [enlace pendiente de publicar]. Diseño propio, pagos con tarjeta, y un panel simple para que ustedes mismos suban sus productos.

¿Te interesaría ver cómo se vería algo así para {{clinicName}}?

Un saludo,
Branel — Agencia`,
    },
    5: {
      subject: 'Re: Una tienda online profesional para {{clinicName}}',
      body: `Hola de nuevo:

Solo para retomar mi correo anterior. Lo dejamos simple: nosotros construimos la tienda, ustedes solo suben sus productos y reciben los pagos.

Si quieres, te muestro el ejemplo en una llamada corta de 15 minutos.

Un saludo,
Branel — Agencia`,
    },
    10: {
      subject: '{{clinicName}} — ¿tiene sentido una tienda online?',
      body: `Hola de nuevo:

Entiendo que quizás no sea el momento, o no esté claro si esto aplica al negocio. Solo por si es útil: un negocio con producto físico y sin tienda propia depende 100% de que el cliente lo contacte directo — una tienda propia amplía ese alcance, incluso si ya tienen Instagram o WhatsApp.

Si en algún momento quieres verlo, aquí estamos.

Un saludo,
Branel — Agencia`,
    },
    20: {
      subject: 'Cierro el tema por ahora',
      body: `Hola:

No quiero insistir de más. Cierro este hilo por ahora, pero si en algún momento quieren una tienda online propia para {{clinicName}}, aquí estaré.

Les dejo mi contacto para cuando sea buen momento.

Un saludo,
Branel — Agencia`,
    },
  },
}
