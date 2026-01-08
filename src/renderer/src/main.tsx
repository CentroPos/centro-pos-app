import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { RouterProvider, createRouter } from '@tanstack/react-router'
import { createHashHistory } from '@tanstack/history'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Import API debug for console access
import '@renderer/services/apiDebug'

// Create a new router instance with hash history for file:// builds
const router = createRouter({ routeTree, history: createHashHistory() })

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
