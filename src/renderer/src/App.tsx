import React, { useState, useEffect } from 'react'
import POSInterface from './components/layout/pos-Interface'
import LoginInterface from './components/layout/login-Interface'
import { useAuthStore } from './store/useAuthStore'
import Providers from './providers/Providers'

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState(false)
  const [currentPage, setCurrentPage] = useState<'login' | 'pos'>('login')
  const { user, validateSession, isAuthenticated, logout } = useAuthStore()

  // Initialize app - ALWAYS start from login page
  useEffect(() => {
    const initializeApp = async () => {
      // Clear any existing auth state to ensure fresh start
      logout()
      
      // FORCE start from login page - no exceptions
      setCurrentPage('login')
      setIsInitialized(true)
    }

    initializeApp()
  }, [logout])

  // ONLY switch to POS when user is authenticated AND we're not on login page
  useEffect(() => {
    if (isInitialized && isAuthenticated && currentPage !== 'pos') {
      // Only switch to POS when user is authenticated (after login)
      setCurrentPage('pos')
    }
  }, [isAuthenticated, isInitialized, currentPage])

  // Handle successful login
  const handleLoginSuccess = () => {
    console.log('Login successful, user:', user)
    setCurrentPage('pos')
  }

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
