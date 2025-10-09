import ErrorBoundary from '@renderer/components/hocs/ErrorBoundary'
import Providers from '@renderer/providers/Providers'
import { createRootRoute, Outlet } from '@tanstack/react-router'

const RootLayout = () => (
  <Providers>
    <Outlet />
  </Providers>
)

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: ({ error, reset }) => <ErrorBoundary error={error} reset={reset} />
})
