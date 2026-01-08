import React, { useState, useEffect } from 'react'
import POSInterface from './components/layout/pos-Interface'
import LoginInterface from './components/layout/login-Interface'
import { useAuthStore } from './store/useAuthStore'
import Providers from './providers/Providers'

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentPage, setCurrentPage] = useState<'login' | 'pos'>('login')
  const { validateSession, isAuthenticated } = useAuthStore()

  // Initialize app - check authentication status
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('App initialization - isAuthenticated:', isAuthenticated)
        
        // If already authenticated, go to POS
        if (isAuthenticated) {
          console.log('User is authenticated, going to POS')
          setCurrentPage('pos')
          setIsInitialized(true)
          return
        }

        // If not authenticated, check if there's stored data
        const storedUserData = localStorage.getItem('userData')
        console.log('Stored user data exists:', !!storedUserData)
        
        if (storedUserData) {
          console.log('Found stored user data, validating session...')
          try {
            const isValid = await validateSession()
            if (isValid) {
              console.log('Session validated successfully, going to POS')
              setCurrentPage('pos')
            } else {
              console.log('Session validation failed, going to login')
              setCurrentPage('login')
            }
          } catch (error) {
            console.log('Session validation error:', error)
            setCurrentPage('login')
          }
        } else {
          console.log('No stored data, going to login')
          setCurrentPage('login')
        }
      } catch (error) {
        console.log('App initialization failed:', error)
        setCurrentPage('login')
      }
      setIsInitialized(true)
    }

    initializeApp()
  }, [isAuthenticated, validateSession])

  // ONLY switch to POS when user is authenticated AND we're not on login page
  useEffect(() => {
    if (isInitialized && isAuthenticated && currentPage !== 'pos') {
      // Only switch to POS when user is authenticated (after login)
      setCurrentPage('pos')
    }
  }, [isAuthenticated, isInitialized, currentPage])

  // Handle logout
  // const handleLogout = () => {
  //   setCurrentPage('login');
  // };

  // Show loading screen while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">Loading CentroERP POS...</p>
        </div>
      </div>
    )
  }
  return (
    <Providers>
      <div className="App">
        {currentPage === 'login' ? (
          <LoginInterface/>
        ) : (
          <POSInterface />
        )}
      </div>
    </Providers>
  )
}

export default App
