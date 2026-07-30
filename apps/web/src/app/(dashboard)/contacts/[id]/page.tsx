import { exigirRol, COMUNES } from '@/lib/exigir-rol'
import { ContactDetail } from '@/components/contacts/contact-detail'

interface Props {
  params: { id: string }
}

export default async function ContactDetailPage({ params }: Props) {
  await exigirRol(COMUNES)

  return <ContactDetail contactId={params.id} />
}
