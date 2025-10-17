export enum API_Endpoints {
  LOGIN = 'api/method/login',
  LOGOUT = 'api/method/logout',

  CUSTOMERS = 'api/resource/Customer',
  CUSTOMER_LIST = 'api/method/centro_pos_apis.api.customer.customer_list',
  CUSTOMER_CREATE = 'api/method/centro_pos_apis.api.customer.create_customer',
  CUSTOMER_EDIT = 'api/method/centro_pos_apis.api.customer.edit_customer',
  CUSTOMER_AMOUNT_INSIGHTS = 'api/method/centro_pos_apis.api.customer.customer_amount_insights',
  CUSTOMER_RECENT_ORDERS = 'api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
  CUSTOMER_MOST_ORDERED = 'api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products',

  PRODUCTS = 'api/resource/Item',
  PRODUCT_LIST_METHOD = 'api/method/centro_pos_apis.api.product.product_list',
  ITEM_WAREHOUSE_LIST_METHOD = 'api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
  PRODUCT_CUSTOMER_HISTORY = 'api/method/centro_pos_apis.api.product.get_product_customer_history',
  PRODUCT_SALES_HISTORY = 'api/method/centro_pos_apis.api.product.get_product_sales_history',
  PRODUCT_PURCHASE_HISTORY = 'api/method/centro_pos_apis.api.product.get_product_purchase_history',

  // Profile
  PROFILE_DETAILS = 'api/method/centro_pos_apis.api.profile.profile_details',
  POS_PROFILE = 'api/method/centro_pos_apis.api.profile.get_pos_profile'

  ,
  // Orders/Payments
  PRICE_LIST = 'api/resource/Price List',
  ORDER_CREATE = 'api/method/centro_pos_apis.api.order.create_order',
  ORDER_EDIT = 'api/method/centro_pos_apis.api.order.edit_order',
  ORDER_CONFIRMATION = 'api/method/centro_pos_apis.api.order.order_confirmation',
  DUE_INVOICE_LIST = 'api/method/centro_pos_apis.api.order.due_invoice_list',
  PAYMENT_CREATE = 'api/method/centro_pos_apis.api.order.create_payment_entry',
  PAYMENT_SEARCH = 'api/method/centro_pos_apis.api.order.search_payment_entries',
  SALES_ORDER = 'api/resource/Sales Order'
}
