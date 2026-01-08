import { useGetQuery, useMutationQuery } from './react-query/useReactQuery'
import { API_Endpoints } from '@renderer/config/endpoints'

export const useCustomerList = (search = '', start = 1, pageLen = 10) =>
  useGetQuery({
    endPoint: API_Endpoints.CUSTOMER_LIST,
    method: 'GET',
    queryParams: { search_term: search, limit_start: start, limit_page_length: pageLen },
    dependency: [search, start, pageLen]
  })

export const useCustomerDetails = (name?: string) =>
  useGetQuery({
    endPoint: name ? `${API_Endpoints.CUSTOMERS}/${name}` : API_Endpoints.CUSTOMERS,
    method: 'GET',
    dependency: [name],
    options: { enabled: !!name }
  })

export const useItemWarehouseList = (itemCode?: string, search = '', start = 0, pageLen = 5) =>
  useGetQuery({
    endPoint: API_Endpoints.ITEM_WAREHOUSE_LIST_METHOD,
    method: 'GET',
    queryParams: { item_code: itemCode, search_text: search, limit_start: start, limit_page_length: pageLen },
    dependency: [itemCode, search, start, pageLen],
    options: { enabled: !!itemCode }
  })

export const useCreateOrder = () =>
  useMutationQuery({ endPoint: API_Endpoints.ORDER_CREATE, method: 'POST' })

export const useEditOrder = () =>
  useMutationQuery({ endPoint: API_Endpoints.ORDER_EDIT, method: 'POST' })

export const useOrderConfirmation = () =>
  useMutationQuery({ endPoint: API_Endpoints.ORDER_CONFIRMATION, method: 'POST' })

export const useCreatePaymentEntry = () =>
  useMutationQuery({ endPoint: API_Endpoints.PAYMENT_CREATE, method: 'POST' })


