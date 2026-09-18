import '../assets/css/globals.css' // CSS is now included here
import { Toaster } from 'react-hot-toast'
import { ReactNode } from 'react'
import { ReduxProvider } from '@/lib/redux/ReduxProvider'
import { NotificationsProvider } from '@/components/notifications/NotificationsProvider'

type RootLayoutProps = {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <head></head>
      <body suppressHydrationWarning className="antialiased">
        <ReduxProvider>
          <NotificationsProvider>
            <Toaster position="bottom-right" reverseOrder={false} />
            {children}
          </NotificationsProvider>
        </ReduxProvider>
      </body>
    </html>
  )
}
