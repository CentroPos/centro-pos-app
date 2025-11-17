import { API_Endpoints } from '@renderer/config/endpoints'
import { useGetQuery } from './react-query/useReactQuery'
import { useQuery } from '@tanstack/react-query'

export const useProfileDetails = () => {
  return useGetQuery({
    endPoint: API_Endpoints.PROFILE_DETAILS,
    method: 'GET',
    dependency: [],
    options: { enabled: true }
  })
}

export const usePosProfile = () => {
  // Use Electron proxy instead of axios to avoid 403 authentication errors
  // The proxy has access to cookies/CSRF tokens that axios can't access in Electron
  const result = useQuery({
    queryKey: [API_Endpoints.POS_PROFILE],
    queryFn: async () => {
      try {
        const response = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.profile.get_pos_profile',
          method: 'GET'
        })
        
        // Handle 404/403 gracefully - return null instead of throwing
        if (!response?.success || !response?.data?.data) {
          console.warn('⚠️ POS profile not found or access denied - returning null')
          return null
        }
        
        return response.data.data
      } catch (error) {
        console.error('❌ Error fetching POS profile:', error)
        // Return null instead of throwing to prevent React errors
        return null
      }
    },
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    throwOnError: false
  })
  
  // Debug logging
  console.log('🔍 usePosProfile result:', result)
  
  return {
    ...result,
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    refetch: result.refetch
  }
}

export type ProfileDetailsResponse = any
export type PosProfileResponse = any





