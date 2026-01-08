import AuthRedirect from './AuthRedirect'
import { useAuthStore } from '@renderer/store/useAuthStore'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  console.log('=== AuthGuard render ===')
  console.log('isLoading:', isLoading)
  console.log('isAuthenticated:', isAuthenticated)

  if (isLoading) {
    console.log('AuthGuard: Showing loading...')
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    )
  }

  if (isAuthenticated) {
    console.log('AuthGuard: User authenticated, showing children')
    return <>{children}</>
  } else {
    console.log('AuthGuard: User not authenticated, showing AuthRedirect')
    return <AuthRedirect />
  }
}
