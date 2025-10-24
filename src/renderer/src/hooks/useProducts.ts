import { API_Endpoints } from '@renderer/config/endpoints'
import { useGetQuery } from './react-query/useReactQuery'

export const useProductList = (searchText = '', priceList = 'Standard Selling', limit = 20) => {
  return useGetQuery({
    endPoint: API_Endpoints.PRODUCT_LIST_METHOD,
    method: 'GET',
    queryParams: {
      price_list: priceList,
      search_text: searchText,
      limit_start: 0,
      limit_page_length: limit
    },
    dependency: [searchText, priceList, limit],
    options: { enabled: true }
  })
}

export const useItemWarehouseStock = (itemId: string, searchText = '', start = 0, len = 5) => {
  return useGetQuery({
    endPoint: API_Endpoints.ITEM_WAREHOUSE_LIST_METHOD,
    method: 'GET',
    queryParams: {
      // Support both item_code (per Postman) and item_id (earlier attempts)
      item_code: itemId,
      item_id: itemId,
      search_text: searchText,
      limit_start: start,
      limit_page_length: len
    },
    dependency: [itemId, searchText, start, len],
    options: { enabled: !!itemId }
  })
}


