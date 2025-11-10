import * as Yup from 'yup'

import React from 'react'
import { useForm } from 'react-hook-form'

import { yupResolver } from '@hookform/resolvers/yup'

import type { SubmitHandler } from 'react-hook-form'
// import { API_Endpoints } from '@renderer/config/endpoints'
// import { useMutationQuery } from '@renderer/hooks/react-query/useReactQuery'
import { ControlledTextField } from '../form/controlled-text-field'
import { Loader2, Lock, UserIcon } from 'lucide-react'
import { Button } from '../ui/button'
import { Form } from '../ui/form'
import { toast } from 'sonner'
import { COMMON_ERROR_MESSAGE } from '@renderer/data/messages'
import { useAuthStore } from '../../store/useAuthStore';
import { useNavigate } from '@tanstack/react-router';
import { BASE_URL_STORAGE_KEY, getApiBaseUrl, sanitizeBaseUrl } from '@renderer/config/production'
import { setApiBaseUrl } from '@renderer/services/api'
import { setFetchApiBaseUrl } from '@renderer/services/fetchAPI'

const schema = Yup.object().shape({
  baseUrl: Yup.string().required('Base URL is required'),
  email: Yup.string().required('This field is required'),
  password: Yup.string()
    .required('This field is required')
    .min(5, 'Password must be at least 5 characters long')
})

type FormData = Yup.InferType<typeof schema>

const LoginPage: React.FC = () => {

  const defaultBaseUrl = React.useMemo(() => getApiBaseUrl(), [])

  const form = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      baseUrl: defaultBaseUrl,
      email: '',
      password: ''
    }
  })

  const { isLoading, login: storeLogin } = useAuthStore()
  const navigate = useNavigate()

  React.useEffect(() => {
    let isMounted = true

    const syncBaseUrlFromMain = async () => {
      if (typeof window === 'undefined' || !window.electronAPI?.proxy?.getBaseUrl) {
        return
      }

      try {
        const mainBaseUrl = await window.electronAPI.proxy.getBaseUrl()
        const normalized = sanitizeBaseUrl(mainBaseUrl)

        if (!isMounted) {
          return
        }

        form.setValue('baseUrl', normalized, { shouldDirty: false, shouldTouch: false })
        setApiBaseUrl(normalized)
        setFetchApiBaseUrl(normalized)

        try {
          window.localStorage.setItem(BASE_URL_STORAGE_KEY, normalized)
        } catch (error) {
          console.warn('Failed to sync base URL to local storage', error)
        }
      } catch (error) {
        console.warn('Failed to retrieve base URL from main process', error)
      }
    }

    void syncBaseUrlFromMain()

    return () => {
      isMounted = false
    }
  }, [form])

  // Remove API mutation login flow; we'll use proxy-backed auth via storeLogin
  const error = null as unknown as any


  console.log('forms.f', form.formState.errors)

  const onSubmit: SubmitHandler<FormData> = async (data: FormData) => {
    try {
      const normalizedBaseUrl = sanitizeBaseUrl(data.baseUrl)

      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(BASE_URL_STORAGE_KEY, normalizedBaseUrl)
        } catch (storageError) {
          console.warn('Failed to persist base URL', storageError)
        }
      }

      setApiBaseUrl(normalizedBaseUrl)
      setFetchApiBaseUrl(normalizedBaseUrl)

      if (typeof window !== 'undefined' && window.electronAPI?.proxy?.setBaseUrl) {
        await window.electronAPI.proxy.setBaseUrl(normalizedBaseUrl)
      }

      form.setValue('baseUrl', normalizedBaseUrl, { shouldDirty: false, shouldTouch: false })

      console.log('=== LOGIN ATTEMPT ===')
      console.log('1. Calling storeLogin...')
      await storeLogin({ username: data.email, password: data.password })
      console.log('2. StoreLogin successful')
      
      toast.success('Login successful!')
      console.log('3. Toast shown, navigating to POS...')
      
      // Navigate to POS page after successful login
      navigate({ to: '/pos', replace: true })
      console.log('4. Navigation completed')
      
    } catch (err: any) {
      console.error('=== LOGIN FAILED ===', err)
      const errorMsg = err?.message || err?.error || COMMON_ERROR_MESSAGE
      toast.error(errorMsg)
    }
  }

  return (
    <div>
      <div className="bg-gradient-to-br from-slate-50 to-gray-100 min-h-screen flex items-center justify-center p-6 font-sans relative">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
          <div className="absolute top-0 right-0 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-4000"></div>
        </div>

        {/* Login Card */}
        <div className="glass-effect rounded-3xl modern-shadow w-full max-w-md p-8 z-10 relative">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-[#334155] to-[#0f172a] rounded-2xl mx-auto mb-4 flex items-center justify-center modern-shadow">
              <i className="fas fa-cash-register text-white text-2xl"></i>
            </div>
            <h1 className="text-3xl font-bold text-primary mb-2">CentroERP POS</h1>
            <p className="text-gray-600 text-sm">Point of Sale for Traders</p>
          </div>

          {/* Login Form */}
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error.message}</p>
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
                <ControlledTextField
                  name="baseUrl"
                  label={"Base URL"}
                  className="block text-sm font-semibold text-gray-700"
                  required
                  control={form.control}
                  placeholder="Enter the ERPNext base URL"
                />
                <ControlledTextField
                  name="email"
                  leftIcon={<UserIcon />}
                  label={"Email or Username"}
                  className="block text-sm font-semibold text-gray-700"
                  required
                  control={form.control}
                  placeholder="Enter your username"
                />
                <ControlledTextField
                  type="password"
                  name="password"
                  label={"Password"}
                  className="block text-sm font-semibold text-gray-700"
                  required
                  control={form.control}
                  leftIcon={<Lock />}
                  placeholder="Enter your password"
                />

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 bg-gradient-to-r from-[#334155] to-[#0f172a] text-white font-semibold rounded-xl hover:shadow-2xl transition-all duration-300 modern-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </Form>
          </div>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-gray-300"></div>
            <span className="px-4 text-sm text-gray-500">or continue with</span>
            <div className="flex-1 border-t border-gray-300"></div>
          </div>

          <div className="space-y-3"></div>

          <div className="text-center mt-8 space-y-3">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?
              <span className="text-accent hover:text-accent/80 font-medium transition-all"> Sign up here</span>
            </p>
            <div className="flex justify-center space-x-6 text-xs text-gray-500">
              <span className="hover:text-gray-700 transition-all cursor-pointer">Privacy Policy</span>
              <span className="hover:text-gray-700 transition-all cursor-pointer">Terms of Service</span>
              <span className="hover:text-gray-700 transition-all cursor-pointer">Support</span>
            </div>
          </div>
        </div>

        <div className="hidden md:block fixed right-60 top-1/2 transform -translate-y-1/2 z-20">
          <div className="glass-effect rounded-2xl p-8 w-80 modern-shadow">
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-accent to-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <i className="fas fa-shopping-cart text-white text-xl"></i>
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">CentroERP POS</h3>
                <p className="text-gray-600 text-sm">Simple Point of Sale for Traders</p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mt-1">
                    <i className="fas fa-barcode text-emerald-600 text-sm"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">Barcode Scanning</h4>
                    <p className="text-xs text-gray-600">Quick product scanning and checkout</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mt-1">
                    <i className="fas fa-receipt text-blue-600 text-sm"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">Receipt Printing</h4>
                    <p className="text-xs text-gray-600">Generate and print customer receipts</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mt-1">
                    <i className="fas fa-credit-card text-purple-600 text-sm"></i>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 text-sm">Payment Processing</h4>
                    <p className="text-xs text-gray-600">Accept cash and card payments</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-accent/10 to-blue-100/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-primary">POS Ready</span>
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <p className="text-xs text-gray-600">System connected to backend</p>
              </div>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="glass-effect rounded-2xl p-8 text-center">
              <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-700 font-medium">Signing you in...</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default LoginPage
