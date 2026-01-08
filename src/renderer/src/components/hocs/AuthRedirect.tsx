import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'

const AuthRedirect = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const login = '/'
  const homePage = '/'
  const redirectUrl = `/?redirectTo=${encodeURIComponent(pathname)}`

  useEffect(() => {
    console.log('=== AuthRedirect useEffect ===')
    console.log('pathname:', pathname)
    console.log('login:', login)
    console.log('homePage:', homePage)
    
    // If the user is already on the login page, do nothing
    if (pathname === login) {
      console.log('Already on login page, doing nothing')
      return
    }

    // Redirect to login with redirectTo param, unless they're already there
    console.log('Redirecting to login page...')
    navigate({
      to: pathname === homePage ? login : redirectUrl,
      replace: true // prevent stacking history
    })
  }, [pathname, navigate, redirectUrl])

  // Nothing to render since this component only redirects
  return null
}

export default AuthRedirect
