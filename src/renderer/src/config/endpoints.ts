export enum API_Endpoints {
  LOGIN = 'method/login',
  LOGOUT = 'method/logout',

  // Local dev server (Node) endpoints
  LOCAL_LOGIN = 'local/login',
  LOCAL_LOGOUT = 'local/logout',
  LOCAL_SESSION = 'local/session',

  CUSTOMERS = 'resource/Customer',
  CUSTOMER_LIST = 'method/centro_pos_apis.api.customer.customer_list',
  CUSTOMER_CREATE = 'method/centro_pos_apis.api.customer.create_customer',
  CUSTOMER_EDIT = 'method/centro_pos_apis.api.customer.edit_customer',
  CUSTOMER_AMOUNT_INSIGHTS = 'method/centro_pos_apis.api.customer.customer_amount_insights',
  CUSTOMER_RECENT_ORDERS = 'method/centro_pos_apis.api.customer.get_customer_recent_orders',
  CUSTOMER_MOST_ORDERED = 'method/centro_pos_apis.api.customer.get_customer_most_ordered_products',

  PRODUCTS = 'resource/Item',
  PRODUCT_LIST_METHOD = 'method/centro_pos_apis.api.product.product_list',
  ITEM_WAREHOUSE_LIST_METHOD = 'method/centro_pos_apis.api.product.item_stock_warehouse_list',
  PRODUCT_CUSTOMER_HISTORY = 'method/centro_pos_apis.api.product.get_product_customer_history',
  PRODUCT_SALES_HISTORY = 'method/centro_pos_apis.api.product.get_product_sales_history',
  PRODUCT_PURCHASE_HISTORY = 'method/centro_pos_apis.api.product.get_product_purchase_history',

  // Profile
  PROFILE_DETAILS = 'method/centro_pos_apis.api.profile.profile_details',
  POS_PROFILE = 'method/centro_pos_apis.api.profile.get_pos_profile',

  // Orders/Payments
  PRICE_LIST = 'resource/Price List',
  ORDER_CREATE = 'method/centro_pos_apis.api.order.create_order',
  ORDER_EDIT = 'method/centro_pos_apis.api.order.edit_order',
  ORDER_CONFIRMATION = 'method/centro_pos_apis.api.order.order_confirmation',
  DUE_INVOICE_LIST = 'method/centro_pos_apis.api.order.due_invoice_list',
  PAYMENT_CREATE = 'method/centro_pos_apis.api.order.create_payment_entry',
  PAYMENT_SEARCH = 'method/centro_pos_apis.api.order.search_payment_entries',
  SALES_ORDER = 'resource/Sales Order'
}
