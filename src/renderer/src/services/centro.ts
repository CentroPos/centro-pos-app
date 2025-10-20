import api from './api'
import { API_Endpoints } from '@renderer/config/endpoints'
import { authAPI } from '@renderer/api/auth'

// Unified client for Centro POS custom methods and Frappe resources
export const centro = {
  // Auth
  login: (credentials: { usr: string; pwd: string }) => authAPI.login({ username: credentials.usr, password: credentials.pwd }),
  logout: () => api.post(API_Endpoints.LOGOUT, {}),

  // Profile
  profileDetails: () => api.get(API_Endpoints.PROFILE_DETAILS),
  posProfile: () => api.get(API_Endpoints.POS_PROFILE),

  // Customers
  customerList: (params: { search_term?: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.CUSTOMERS, { params }),
  customerCreate: (payload: any) => api.post(API_Endpoints.CUSTOMER_CREATE, payload),
  customerEdit: (payload: any) => api.post(API_Endpoints.CUSTOMER_EDIT, payload),
  customerResourceList: (params?: any) => api.get(API_Endpoints.CUSTOMERS, { params }),
  customerDetails: (name: string) => api.get(`${API_Endpoints.CUSTOMERS}/${name}`),
  customerAmountInsights: (params: { customer: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.CUSTOMER_AMOUNT_INSIGHTS, { params }),
  customerRecentOrders: (params: { customer: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.CUSTOMER_RECENT_ORDERS, { params }),
  customerMostOrdered: (params: { customer: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.CUSTOMER_MOST_ORDERED, { params }),

  // Products
  productListMethod: (params: { price_list: string; search_text?: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.PRODUCT_LIST_METHOD, { params }),
  productDetails: (itemCode: string) => api.get(`${API_Endpoints.PRODUCTS}/${itemCode}`),
  itemWarehouseList: (params: { item_code: string; search_text?: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.ITEM_WAREHOUSE_LIST_METHOD, { params }),
  productCustomerHistory: (params: { customer: string; item_code: string; limit: number; start: number }) =>
    api.get(API_Endpoints.PRODUCT_CUSTOMER_HISTORY, { params }),
  productSalesHistory: (params: { product_id: string; limit_start: number; limit_page_length: number }) =>
    api.get(API_Endpoints.PRODUCT_SALES_HISTORY, { params }),
  productPurchaseHistory: (params: { product_id: string; limit_start: number; limit_page_length: number }) =>
    api.get(API_Endpoints.PRODUCT_PURCHASE_HISTORY, { params }),

  // Orders / Payments
  getPriceLists: (params: { filters?: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.PRICE_LIST, { params }),
  createOrder: (payload: any) => api.post(API_Endpoints.ORDER_CREATE, payload),
  editOrder: (payload: any) => api.post(API_Endpoints.ORDER_EDIT, payload),
  orderConfirmation: (payload: any) => api.post(API_Endpoints.ORDER_CONFIRMATION, payload),
  dueInvoiceList: (params: { customer_id: string; limit_start?: number; limit_page_length?: number }) =>
    api.get(API_Endpoints.DUE_INVOICE_LIST, { params }),
  createPaymentEntry: (payload: any) => api.post(API_Endpoints.PAYMENT_CREATE, payload),
  searchPaymentEntries: (params: { search_term?: string }) => api.post(API_Endpoints.PAYMENT_SEARCH, undefined, { params })
}

export default centro


