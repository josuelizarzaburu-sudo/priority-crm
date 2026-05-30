import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { PushNotificationBanner } from '@/components/layout/push-notification-banner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <div className="flex h-screen overflow-hidden bg-[#f0f2f7]">
      {/* Sidebar: visible on desktop, drawer on mobile */}
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        {/* pb-24 on mobile reserves space above bottom nav */}
        <main className="flex-1 overflow-auto p-4 pb-24 md:p-6 md:pb-6">
          <div className="flex flex-col gap-4">
            <PushNotificationBanner />
            {children}
          </div>
        </main>
      </div>

      {/* Bottom navigation — mobile only (md:hidden inside component) */}
      <BottomNav />
    </div>
  )
}
