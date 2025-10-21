import { API_Endpoints } from '@renderer/config/endpoints'
import { useGetQuery } from './react-query/useReactQuery'

export const useProfileDetails = () => {
  return useGetQuery({
    endPoint: API_Endpoints.PROFILE_DETAILS,
    method: 'GET',
    dependency: [],
    options: { enabled: true }
  })
}

export const usePosProfile = () => {
  const result = useGetQuery({
    endPoint: API_Endpoints.POS_PROFILE,
    method: 'GET',
    dependency: [],
    options: { enabled: true }
  })
  
  // Debug logging
  console.log('🔍 usePosProfile result:', result)
  
  return result
}

export type ProfileDetailsResponse = any
export type PosProfileResponse = any





