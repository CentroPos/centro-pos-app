/* eslint-disable @typescript-eslint/no-explicit-any */
import { CustomerCreateData, customersAPI } from '@renderer/api/customer'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query keys
export const customerKeys = {
  all: ['customers'],
  lists: () => [...customerKeys.all, 'list'],
  list: (filters: any) => [...customerKeys.lists(), filters],
  details: () => [...customerKeys.all, 'detail'],
  detail: (id: string) => [...customerKeys.details(), id]
}

// Hook to get all customers
export const useCustomers = (params = {}) => {
  console.log('🪝 useCustomers called with params:', params)
  const query = useQuery({
    queryKey: customerKeys.list(params),
    queryFn: async () => {
      console.log('🪝 useCustomers queryFn executing...')
      const result = await customersAPI.getAll(params)
      console.log('🪝 useCustomers queryFn result:', result)
      return result
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true, // Explicitly enable the query
    retry: 1
  })
  
  console.log('🪝 useCustomers query state:', {
    data: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    status: query.status
  })
  
  return query
}

// New: Fetch customers using Electron proxy custom method with search support
export const useCustomersViaProxy = (searchTerm: string) => {
  return useQuery({
    queryKey: [...customerKeys.lists(), 'proxy', searchTerm],
    queryFn: async () => {
      const res = await window.electronAPI?.proxy?.request({
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: { search_term: searchTerm || '', limit_start: 1, limit_page_length: 50 }
      })
      const list = Array.isArray(res?.data?.data)
        ? res.data.data
        : Array.isArray(res?.data?.message)
          ? res.data.message
          : []
      return list.map((c: any) => ({ name: c.name, gst: c.gst || 'Not Available' }))
    },
    staleTime: 2 * 60 * 1000
  })
}

// Hook to get a single customer
export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: customerKeys.detail(id),
    queryFn: () => customersAPI.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

// Hook to search customers
export const useCustomerSearch = (query: string, params = {}) => {
  return useQuery({
    queryKey: [...customerKeys.lists(), 'search', query, params],
    queryFn: () => customersAPI.search(query, params),
    enabled: !!query,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })
}

// Hook to create a customer
export const useCreateCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (customerData: CustomerCreateData) => customersAPI.create(customerData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    }
  })
}

// Hook to delete a customer
export const useDeleteCustomer = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => customersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.lists() })
    }
  })
}
