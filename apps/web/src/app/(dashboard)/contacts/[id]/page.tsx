import { ContactDetail } from '@/components/contacts/contact-detail'

interface Props {
  params: { id: string }
}

export default function ContactDetailPage({ params }: Props) {
  return <ContactDetail contactId={params.id} />
}
