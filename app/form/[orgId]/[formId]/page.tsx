import { Metadata } from 'next'
import CaptureFormClient from './CaptureFormClient'

export const metadata: Metadata = { title: 'Formulario de contacto' }

export default function CaptureFormPage({ params }: { params: { orgId: string; formId: string } }) {
  return <CaptureFormClient orgId={params.orgId} formId={params.formId} />
}
