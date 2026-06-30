import { create } from 'zustand'

interface POSProfileUser {
  user: string
  custom_enable_sales?: number
  custom_enable_purchase?: number
  custom_sales_counter: number
  custom_billing_counter: number
  custom_return_counter: number
  custom_allow_purchase_history_in_sales?: number
}

interface POSProfile {
  name: string
  company?: string
  selling_price_list: string
  applicable_for_users: POSProfileUser[]
  currency?: string
  currency_symbol?: string
  custom_currency_symbol?: string
  custom_allow_duplicate_items_in_cart?: number
  custom_allow_item_label_editing?: number
  custom_allow_order_date_change?: number
  custom_allow_backdated_purchases?: number
  warehouse?: string
  custom_hide_cost_and_margin_info?: number
  custom_show_purchase_history?: number
  custom_enable_retail_mode?: number
  custom_hide_alternate_products?: number
  custom_hide_item_offers?: number
  taxes_and_charges?: string
  custom_tax_rate?: number
  custom_exempt_taxes_and_charges?: string
  custom_exempt_tax_rate?: number
  custom_default_line_item_discount_mode?: 'Per Unit' | 'Row Total'
  // Discount Configuration Fields
  custom_hide_sales_item_discounts?: number
  custom_hide_sales_additional_discount?: number
  custom_hide_purchase_item_discounts?: number
  custom_hide_purchase_additional_discount?: number

  // Purchase-specific fields
  custom_buying_price_list?: string
  custom_purchase_taxes_and_charges?: string
  custom_purchase_tax_rate?: number
  custom_default_purchase_warehouse?: string
  custom_enable_receipt_wise_purchase?: number
  custom_enable_landed_cost_entry?: number
  // Allowed warehouses for returns
  allowed_warehouses?: Array<{ name: string }>
}

interface POSProfileStore {
  profile: POSProfile | null
  currentUserPrivileges: {
    sales: boolean
    purchase: boolean
    billing: boolean
    return: boolean
    custom_allow_purchase_history_in_sales?: boolean
  } | null
  setProfile: (profile: POSProfile) => void
  setCurrentUserPrivileges: (userEmail: string) => void
}

export const usePOSProfileStore = create<POSProfileStore>((set, get) => ({
  profile: null,
  currentUserPrivileges: null,
  
  setProfile: (profile: POSProfile) => {
    set({ profile })
  },
  
  setCurrentUserPrivileges: (userEmail: string) => {
    const { profile } = get()
    console.log('🔍 setCurrentUserPrivileges called with userEmail:', userEmail)
    console.log('🔍 Profile available:', !!profile)
    
    if (!profile) {
      console.log('❌ No profile found in store when setting privileges.')
      return
    }
    
    console.log('🔍 Profile applicable_for_users:', profile.applicable_for_users)
    console.log('🔍 Looking for user email:', userEmail)
    
    // Find the current user in applicable_for_users
    // Try exact match first
    let currentUser = profile.applicable_for_users.find(
      user => user.user === userEmail
    )
    
    // If no exact match, try to find by partial match or use the first user
    if (!currentUser) {
      console.log('🔍 No exact match found, trying alternative approaches...')
      
      // Try to find by partial email match (before @)
      const emailPrefix = userEmail.split('@')[0]
      currentUser = profile.applicable_for_users.find(
        user => user.user.split('@')[0] === emailPrefix
      )
      
      // If still no match, use the first user (for testing purposes)
      if (!currentUser && profile.applicable_for_users.length > 0) {
        currentUser = profile.applicable_for_users[0]
        console.log('🔍 Using first available user for testing:', currentUser)
      }
    }
    
    console.log('🔍 Found current user:', currentUser)
    
    if (currentUser) {
      console.log('✅ Current user found in profile:', currentUser)
      console.log('🔍 Raw privilege values:', {
        custom_enable_sales: (currentUser as any).custom_enable_sales,
        custom_enable_purchase: (currentUser as any).custom_enable_purchase,
        custom_sales_counter: currentUser.custom_sales_counter,
        custom_billing_counter: currentUser.custom_billing_counter,
        custom_return_counter: currentUser.custom_return_counter
      })
      
      const privileges = {
        // Feature enable flags (separate from counters)
        sales: (currentUser as any).custom_enable_sales === 1 || currentUser.custom_sales_counter === 1,
        purchase: (currentUser as any).custom_enable_purchase === 1,
        billing: currentUser.custom_billing_counter === 1,
        return: currentUser.custom_return_counter === 1,
        custom_allow_purchase_history_in_sales: currentUser.custom_allow_purchase_history_in_sales === 1
      }
      
      console.log('✅ Setting privileges:', privileges)
      set({
        currentUserPrivileges: privileges
      })
    } else {
      console.log('❌ Current user NOT found in profile. Setting default false privileges.')
      console.log('🔍 Available user emails:', profile.applicable_for_users.map(u => u.user))
      // Default privileges if user not found
      set({
        currentUserPrivileges: {
          sales: false,
          purchase: false,
          billing: false,
          return: false,
          custom_allow_purchase_history_in_sales: false
        }
      })
    }
  }
}))

export default usePOSProfileStore
