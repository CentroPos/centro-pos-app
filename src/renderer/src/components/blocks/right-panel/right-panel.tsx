import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { RefreshCcw } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { toast } from 'sonner'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'
import { useHotkeys } from 'react-hotkeys-hook'
import PaymentTab from '../payment/payment-tab'
import MultiWarehousePopup from '../common/multi-warehouse-popup'

// A right-side panel for the POS screen, adapted from pos.html
// Contains tabs for Product, Customer, Prints, Payments, Orders
// and renders the contextual info shown in the design mock.

// Prints Tab Content Component
const PrintsTabContent: React.FC = () => {
  // All hooks must be called unconditionally and in the same order every render
  const { getCurrentTab } = usePOSTabStore()
  const currentTab = getCurrentTab()
  const [printItems, setPrintItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfPreviews, setPdfPreviews] = useState<Record<string, string>>({})
  const [activePrintTab, setActivePrintTab] = useState<string>('')
  const [instantPrintPreview, setInstantPrintPreview] = useState<string>('')
  const [refreshKey, setRefreshKey] = useState(0)
  const prevOrderIdRef = useRef<string | null>(null)
  const prevInstantPrintUrlForSelectionRef = useRef<string | null>(null)
  const prevInstantPrintUrlRef = useRef<string | null>(null)
  const printItemsCache = useRef<Record<string, any[]>>({})
  const pdfPreviewsCache = useRef<Record<string, string>>({})
  const isMountedRef = useRef(true)
  
  // Track mount status to prevent state updates on unmounted component
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  const getItemKey = (item: any) => `${item.report_title}-${item.doc_id || item.url}`
  const getFormatList = (item: any) => {
    const formats = Array.isArray(item.formats) && item.formats.length > 0 ? item.formats : []
    if (formats.length === 0) {
      return [
        {
          format_name: item.format_name || 'Default',
          url: item.url,
          default: 1
        }
      ]
    }
    return formats
  }
  const getDefaultFormatUrl = (item: any) => {
    const formats = getFormatList(item)
    const defaultFormat = formats.find((f: any) => f?.default === 1)
    return defaultFormat?.url || formats[0]?.url || item.url
  }
  const normalizePrintItem = (item: any) => {
    const defaultUrl = getDefaultFormatUrl(item)
    return {
      ...item,
      selected_format_url: item.selected_format_url || defaultUrl
    }
  }

  const handleFormatChange = (itemKey: string, formatUrl: string) => {
    const item = printItems.find((printItem) => getItemKey(printItem) === itemKey)
    if (item) {
      void loadPDFPreview({ ...item, selected_format_url: formatUrl }, formatUrl)
    }
    setPrintItems((prev) =>
      prev.map((printItem) => {
        const key = getItemKey(printItem)
        if (key !== itemKey) return printItem
        return { ...printItem, selected_format_url: formatUrl }
      })
    )
    const currentOrderId = currentTab?.orderId
    if (currentOrderId && printItemsCache.current[currentOrderId]) {
      printItemsCache.current[currentOrderId] = printItemsCache.current[currentOrderId].map(
        (printItem: any) => {
          const key = getItemKey(printItem)
          if (key !== itemKey) return printItem
          return { ...printItem, selected_format_url: formatUrl }
        }
      )
    }
  }

  const handlePrintsRefresh = () => {
    const currentOrderId = getCurrentTab()?.orderId
    if (currentOrderId) {
      delete printItemsCache.current[currentOrderId]
    }
    setPdfPreviews({})
    pdfPreviewsCache.current = {}
    setActivePrintTab('')
    setRefreshKey((prev) => prev + 1)
  }

  // Load PDF preview for a specific item
  const loadPDFPreview = async (item: any, formatUrlOverride?: string) => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) {
      return
    }
    
    const itemKey = getItemKey(item)
    const formatUrl =
      formatUrlOverride || item.selected_format_url || getDefaultFormatUrl(item)
    
    const previewKey = `${itemKey}-${formatUrl}`

    // Check both current state and persistent cache
    if (pdfPreviews[previewKey] || pdfPreviewsCache.current[previewKey]) {
      console.log('📄 PDF preview already cached for:', item.report_title)
      // Restore from cache if not in current state
      if (!pdfPreviews[previewKey] && pdfPreviewsCache.current[previewKey] && isMountedRef.current) {
        setPdfPreviews((prev) => ({
          ...prev,
          [previewKey]: pdfPreviewsCache.current[previewKey]
        }))
      }
      return
    }

    try {
      console.log('📄 Loading PDF preview for:', item.report_title)

      // Use proxy API which handles authentication, CORS, and PDF conversion
      const response = await window.electronAPI?.proxy.request({
        url: formatUrl,
        method: 'GET'
      })

      if (!response?.success) {
        throw new Error(`Failed to fetch PDF: ${response?.status || 'Unknown error'}`)
      }

      // The proxy API already converts PDFs to base64 data URLs
      // response.pdfData is already a full data URL like "data:application/pdf;base64,..."
      if (response.pdfData) {
        // Append zoom parameter for PDF viewer
        const dataUrl = `${response.pdfData}#zoom=fit`
        if (isMountedRef.current) {
          setPdfPreviews((prev) => ({ ...prev, [previewKey]: dataUrl }))
          // Also save to persistent cache
          pdfPreviewsCache.current[previewKey] = dataUrl
          console.log('📄 PDF preview loaded and cached for:', item.report_title)
        }
      } else {
        console.log('📄 Response does not contain PDF data for:', item.report_title)
      }
    } catch (error) {
      console.log('📄 PDF preview loading handled gracefully for:', item.report_title, error)
    }
  }

  // Load instant print preview when URL is available
  useEffect(() => {
    const instantPrintUrl = currentTab?.instantPrintUrl
    if (instantPrintUrl) {
      // Use proxy API which handles authentication, CORS, and PDF conversion
      window.electronAPI?.proxy
        .request({
          url: instantPrintUrl,
          method: 'GET'
        })
        .then((response) => {
          if (response?.success && response?.pdfData && isMountedRef.current) {
            // response.pdfData is already a full data URL, just append zoom parameter
            const dataUrl = `${response.pdfData}#zoom=fit`
            setInstantPrintPreview(dataUrl)
            console.log('📄 Instant print preview loaded')
          }
        })
        .catch((error) => {
          console.log('📄 Error loading instant print preview:', error)
        })
    } else {
      if (isMountedRef.current) {
        setInstantPrintPreview('')
      }
    }
  }, [currentTab?.instantPrintUrl, refreshKey])

  // Set active tab when instant print URL is available or printItems change
  useEffect(() => {
    // Don't update state if component is unmounted
    if (!isMountedRef.current) {
      return
    }
    
    const currentInstantPrintUrl = currentTab?.instantPrintUrl || null
    const instantPrintUrlJustSet = currentInstantPrintUrl && currentInstantPrintUrl !== prevInstantPrintUrlForSelectionRef.current

    // If instant print URL is available and was just set (after save/update/confirm/pay/return), always select it
    // This ensures navigation to Instant Print tab after these actions
    if (instantPrintUrlJustSet) {
      console.log('🖨️ Instant print URL just set, selecting Instant Print tab')
      if (isMountedRef.current) {
        setActivePrintTab('instant-print')
      }
      prevInstantPrintUrlForSelectionRef.current = currentInstantPrintUrl
      return
    }

    // If instant print URL exists and no tab is selected, select Instant Print
    if (currentTab?.instantPrintUrl && !activePrintTab) {
      if (isMountedRef.current) {
        setActivePrintTab('instant-print')
      }
      prevInstantPrintUrlForSelectionRef.current = currentInstantPrintUrl
    } else if (printItems.length > 0 && !activePrintTab && !currentTab?.instantPrintUrl) {
      // If no instant print URL, select first API tab
      const firstItemKey = getItemKey(printItems[0])
      if (isMountedRef.current) {
        setActivePrintTab(firstItemKey)
      }
    } else if (printItems.length === 0 && !activePrintTab) {
      // Default to Instant Print if no API tabs available
      if (isMountedRef.current) {
        setActivePrintTab('instant-print')
      }
    }

    // Update ref to track current instant print URL
    if (currentInstantPrintUrl) {
      prevInstantPrintUrlForSelectionRef.current = currentInstantPrintUrl
    }
  }, [printItems, activePrintTab, currentTab?.instantPrintUrl, refreshKey])

  // Fetch print items when component mounts or order changes
  useEffect(() => {
    const fetchPrintItems = async () => {
      const currentOrderId = currentTab?.orderId
      const currentInstantPrintUrl = currentTab?.instantPrintUrl || null
      console.log('🖨️ useEffect triggered - currentOrderId:', currentOrderId)
      console.log('🖨️ useEffect triggered - prevOrderId:', prevOrderIdRef.current)
      console.log('🖨️ useEffect triggered - currentInstantPrintUrl:', currentInstantPrintUrl)
      console.log('🖨️ useEffect triggered - prevInstantPrintUrl:', prevInstantPrintUrlRef.current)

      // Check if instant print URL changed (indicates a new action was performed)
      const instantPrintUrlChanged = currentInstantPrintUrl !== prevInstantPrintUrlRef.current
      if (instantPrintUrlChanged && currentInstantPrintUrl) {
        console.log('🖨️ Instant print URL changed, will refresh print items')
        prevInstantPrintUrlRef.current = currentInstantPrintUrl
        // Clear cache to force fresh fetch
        if (currentOrderId) {
          delete printItemsCache.current[currentOrderId]
        }
      }

      // Check if we have pre-fetched print items from order opening (only if order ID changed)
      const orderIdChanged = currentOrderId !== prevOrderIdRef.current
      const preFetched = currentTab?.orderData?._relatedData?.printItems
      if (preFetched && Array.isArray(preFetched) && preFetched.length > 0 && orderIdChanged && !instantPrintUrlChanged) {
        console.log('✅ Using pre-fetched print items from order')
        const normalizedPrefetched = preFetched.map(normalizePrintItem)
        if (isMountedRef.current) {
          setPrintItems(normalizedPrefetched)
        }
        if (currentOrderId) {
          printItemsCache.current[currentOrderId] = normalizedPrefetched
        }
        // Auto-load PDF previews
        if (isMountedRef.current) {
          preFetched.forEach((item: any, index: number) => {
            const defaultFormat = getDefaultFormatUrl(item)
            setTimeout(() => {
              if (isMountedRef.current) {
                loadPDFPreview(item, defaultFormat)
              }
            }, index * 100)
          })
        }
        prevOrderIdRef.current = currentOrderId || null
        return
      }

      // Check if we have cached data for this order (only if order ID didn't change and instant print URL didn't change)
      if (currentOrderId && printItemsCache.current[currentOrderId] && !orderIdChanged && !instantPrintUrlChanged) {
        console.log('🖨️ Using cached print items for order:', currentOrderId)
        if (isMountedRef.current) {
          setPrintItems(printItemsCache.current[currentOrderId])
          // Restore PDF previews from cache
          setPdfPreviews(pdfPreviewsCache.current)
        }
        return
      }

      // Only fetch if order ID actually changed OR instant print URL changed
      if (currentOrderId === prevOrderIdRef.current && !instantPrintUrlChanged) {
        console.log('🖨️ Order ID and instant print URL unchanged, skipping fetch')
        return
      }

      // Update the refs
      prevOrderIdRef.current = currentOrderId || null
      if (currentInstantPrintUrl) {
        prevInstantPrintUrlRef.current = currentInstantPrintUrl
      }

      if (!currentOrderId) {
        console.log('🖨️ No orderId, setting empty array')
        if (isMountedRef.current) {
          setPrintItems([])
        }
        return
      }

      console.log('🖨️ Starting API call for order:', currentTab.orderId)
      if (isMountedRef.current) {
        setLoading(true)
        setError(null)
      }

      try {
        console.log(
          '🖨️ Making API request to:',
          '/api/method/centro_pos_apis.api.print.print_items_list'
        )
        console.log('🖨️ Request data:', { order_id: currentTab.orderId })

        const response = await window.electronAPI?.proxy?.request({
          method: 'POST',
          url: '/api/method/centro_pos_apis.api.print.print_items_list',
          data: {
            order_id: currentTab.orderId
          }
        })

        console.log('🖨️ API call completed')
        console.log('🖨️ Full response object:', response)
        console.log('🖨️ Response success:', response?.success)
        console.log('🖨️ Response data:', response?.data)
        console.log('🖨️ Response data type:', typeof response?.data)
        console.log('🖨️ Response data is array:', Array.isArray(response?.data))
        console.log('🖨️ Response keys:', response ? Object.keys(response) : 'No response')

        if (response?.success && response?.data) {
          // The actual print items array is nested at response.data.data
          const actualData = response.data.data || response.data
          const data = Array.isArray(actualData) ? actualData : []
          console.log('🖨️ Actual data from response.data.data:', actualData)
          console.log('🖨️ Processed print items data:', data)
          console.log('🖨️ Data length:', data.length)
          const normalizedData = data.map(normalizePrintItem)
          
          // Only update state if component is still mounted
          if (isMountedRef.current) {
            setPrintItems(normalizedData)
          }

          // Cache the print items
          if (currentOrderId) {
            printItemsCache.current[currentOrderId] = normalizedData
          }

          // Auto-load PDF previews for all items (faster loading)
          if (normalizedData.length > 0 && isMountedRef.current) {
            normalizedData.forEach((item: any, index: number) => {
              const defaultFormat = item.selected_format_url || getDefaultFormatUrl(item)
              setTimeout(() => {
                if (isMountedRef.current) {
                  loadPDFPreview(item, defaultFormat)
                }
              }, index * 100)
            })
          }
        } else {
          console.log('🖨️ No valid data in response, setting empty array')
          console.log('🖨️ Response success was:', response?.success)
          console.log('🖨️ Response data was:', response?.data)
          console.log('🖨️ Response message was:', response?.message)
          if (isMountedRef.current) {
            setPrintItems([])
          }
        }
      } catch (err) {
        console.error('❌ Error fetching print items:', err)
        console.error('❌ Error details:', {
          message: (err as any)?.message,
          stack: (err as any)?.stack,
          name: (err as any)?.name
        })
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setError((err as any)?.message || 'Failed to fetch print items')
        }
      } finally {
        console.log('🖨️ API call finished, setting loading to false')
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }

    console.log('🖨️ Calling fetchPrintItems')
    fetchPrintItems()
  }, [currentTab?.orderId, currentTab?.instantPrintUrl, refreshKey])

  // Keyboard navigation for print sub tabs (MUST be before any conditional returns)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey && e.shiftKey)) return
      const key = e.key.toLowerCase()
      if (key === 'd') {
        if (!Array.isArray(printItems) || printItems.length === 0) return
        e.preventDefault()
        const index = printItems.findIndex(i => getItemKey(i) === activePrintTab)
        const nextIndex = (index + 1) % printItems.length
        const nextKey = getItemKey(printItems[nextIndex])
        setActivePrintTab(nextKey)
      } else if (key === 'a') {
        if (!Array.isArray(printItems) || printItems.length === 0) return
        e.preventDefault()
        const index = printItems.findIndex(i => getItemKey(i) === activePrintTab)
        const prevIndex = (index - 1 + printItems.length) % printItems.length
        const prevKey = getItemKey(printItems[prevIndex])
        setActivePrintTab(prevKey)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activePrintTab, printItems])

  // Load PDF preview for selected format (MUST be before any conditional returns)
  useEffect(() => {
    const isInstantPrintActive = activePrintTab === 'instant-print'
    if (isInstantPrintActive) return
    
    const selectedItem = printItems.find((item) => getItemKey(item) === activePrintTab)
    if (!selectedItem) return
    
    const activeFormatUrl = selectedItem.selected_format_url || getDefaultFormatUrl(selectedItem)
    if (!activeFormatUrl) return
    
    const activeItemKey = getItemKey(selectedItem)
    const activePreviewKey = `${activeItemKey}-${activeFormatUrl}`
    
    if (!pdfPreviews[activePreviewKey] && !pdfPreviewsCache.current[activePreviewKey]) {
      void loadPDFPreview(selectedItem, activeFormatUrl)
    }
  }, [activePrintTab, printItems, pdfPreviews])

  // Calculate values needed for useHotkeys (MUST be before any conditional returns)
  const isInstantPrintActive = activePrintTab === 'instant-print'
  const selectedItem = printItems.find((item) => getItemKey(item) === activePrintTab)
  const activeItemKey = selectedItem ? getItemKey(selectedItem) : ''
  const activeFormatUrl = selectedItem
    ? selectedItem.selected_format_url || getDefaultFormatUrl(selectedItem)
    : ''
  const activePreviewKey =
    selectedItem && activeFormatUrl ? `${activeItemKey}-${activeFormatUrl}` : ''
  const isPrintEnabled = isInstantPrintActive
    ? !!instantPrintPreview
    : !!(activePreviewKey && (pdfPreviews[activePreviewKey] || pdfPreviewsCache.current[activePreviewKey]))

  // Handle print action (MUST be before any conditional returns)
  const handlePrint = async () => {
    try {
      let pdfDataUrl = ''
      if (isInstantPrintActive) {
        pdfDataUrl = instantPrintPreview
      } else if (selectedItem) {
        const previewKey = activePreviewKey
        pdfDataUrl = previewKey ? pdfPreviews[previewKey] : ''

        if (!pdfDataUrl && previewKey) {
          console.log('⏳ PDF preview not loaded yet, checking cache...')
          const cachedPdfUrl = pdfPreviewsCache.current[previewKey]
          if (cachedPdfUrl) {
            console.log('📄 Found PDF in persistent cache, restoring...')
            if (isMountedRef.current) {
              setPdfPreviews((prev) => ({ ...prev, [previewKey]: cachedPdfUrl }))
            }
            pdfDataUrl = cachedPdfUrl
          } else if (activeFormatUrl) {
            console.log('⏳ Loading PDF preview now...')
            await loadPDFPreview(selectedItem, activeFormatUrl)
            await new Promise((resolve) => setTimeout(resolve, 1000))
            pdfDataUrl = pdfPreviewsCache.current[previewKey] || pdfPreviews[previewKey]
          }
        }
      }

      if (pdfDataUrl) {
        // Use the print function with silent error handling
        const result = await window.electronAPI?.print.printPDF(pdfDataUrl)
        console.log('🖨️ Print result:', result)

        if (result?.success) {
          console.log('✅ Print dialog opened successfully')
        } else {
          console.log('ℹ️ Print dialog may not have opened, but this is normal')
        }
      }
    } catch (error: any) {
      console.log('ℹ️ Print operation completed (errors are handled silently)')
    }
  }

  // Keyboard shortcut for print (MUST be before any conditional returns)
  useHotkeys(
    'ctrl+shift+p',
    (e) => {
      if (isPrintEnabled) {
        e.preventDefault()
        console.log('⌨️ Ctrl+Shift+P pressed - triggering print')
        handlePrint()
      }
    },
    { enableOnFormTags: true }
  )

  if (!currentTab?.orderId) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-print text-2xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Order Selected</h3>
          <p className="text-sm text-gray-500">Please save an order first to view print options</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading print options...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-2xl text-red-500"></i>
          </div>
          <h3 className="text-lg font-semibold text-red-600 mb-2">Error Loading Print Options</h3>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  // Debug logging
  console.log('🖨️ PrintsTabContent render - printItems:', printItems)
  console.log('🖨️ PrintsTabContent render - printItems type:', typeof printItems)
  console.log('🖨️ PrintsTabContent render - printItems is array:', Array.isArray(printItems))
  console.log('🖨️ PrintsTabContent render - printItems length:', printItems?.length)

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Print Options</h3>
          <p className="text-sm text-gray-600">Order: {currentTab.orderId}</p>
        </div>
        <button
          type="button"
          onClick={handlePrintsRefresh}
          className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
          title="Refresh print options"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {currentTab?.orderId ? (
        <>
          {/* Tabs - Instant Print always first, then dynamic tabs from API */}
          <div className="flex border-b border-gray-200/60 mb-4 overflow-x-auto">
            {/* Instant Print Tab - Always present as first tab */}
            <button
              className={`px-4 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-all ${
                isInstantPrintActive
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-black hover:bg-white/40 border-transparent'
              }`}
              onClick={() => setActivePrintTab('instant-print')}
            >
              Instant Print
            </button>
            {/* Dynamic Tabs from API */}
            {printItems.map((item, index) => {
              const itemKey = getItemKey(item)
              const isActive = activePrintTab === itemKey
              return (
                <button
                  key={index}
                  className={`px-4 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-all ${
                    isActive
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:text-black hover:bg-white/40 border-transparent'
                  }`}
                  onClick={() => setActivePrintTab(itemKey)}
                >
                  {item.report_title}
                </button>
              )
            })}
          </div>

          {/* Selected Tab Content */}
          {(isInstantPrintActive || selectedItem) && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-end mb-3 gap-3">
                {!isInstantPrintActive && selectedItem && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Print Format
                    </span>
                    <Select
                      value={activeFormatUrl}
                      onValueChange={(value) => handleFormatChange(activeItemKey, value)}
                    >
                      <SelectTrigger className="w-48 h-9 text-sm max-w-48 [&_[data-slot=select-value]]:truncate [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFormatList(selectedItem).map((format: any) => (
                          <SelectItem key={format.url} value={format.url}>
                            {format.format_name || 'Default'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePrint}
                  onKeyDown={(e) => {
                    // Prevent Enter key from triggering print
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
                  title="Print with Printer Selection"
                  disabled={
                    isInstantPrintActive
                      ? !instantPrintPreview
                      : !(activePreviewKey && (pdfPreviews[activePreviewKey] || pdfPreviewsCache.current[activePreviewKey]))
                  }
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Print
                  <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Shift+P</span>
                </button>
              </div>

              {/* PDF Preview */}
              <div className="bg-gray-50 rounded border p-3 flex-1 overflow-hidden flex flex-col">
                <div className="bg-white rounded border overflow-hidden flex-1" style={{ display: 'flex', flexDirection: 'column' }}>
                  {isInstantPrintActive ? (
                    instantPrintPreview ? (
                      <iframe
                        src={instantPrintPreview}
                        className="w-full h-full border-0"
                        style={{ minHeight: '100%', minWidth: '100%' }}
                        title="Instant Print"
                        onLoad={() => console.log('📄 Instant Print PDF preview loaded')}
                      />
                    ) : currentTab?.instantPrintUrl ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg
                              className="w-6 h-6 text-gray-400 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                          </div>
                          <p className="text-sm text-gray-500">Loading preview...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i className="fas fa-print text-2xl text-gray-400"></i>
                          </div>
                          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Print Available</h3>
                          <p className="text-sm text-gray-500">Print will be available after creating, updating, confirming, paying, or returning an order.</p>
                        </div>
                      </div>
                    )
                  ) : selectedItem ? (
                    activePreviewKey && pdfPreviews[activePreviewKey] ? (
                    <iframe
                      src={pdfPreviews[activePreviewKey]}
                      className="w-full h-full border-0"
                      style={{ minHeight: '100%', minWidth: '100%' }}
                      title={selectedItem.report_title}
                      onLoad={() => console.log('📄 PDF preview loaded:', selectedItem.report_title)}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2">
                          <svg
                            className="w-6 h-6 text-gray-400 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        </div>
                        <p className="text-sm text-gray-500">Loading preview...</p>
                        <button
                          onClick={() => loadPDFPreview(selectedItem, activeFormatUrl)}
                          className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          Click to load preview
                        </button>
                      </div>
                    </div>
                    )
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-print text-2xl text-gray-400"></i>
          </div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Print Options Available</h3>
          <p className="text-sm text-gray-500">No print formats found for this order</p>
        </div>
      )}
    </div>
  )
}

type RightPanelProps = {
  selectedItemId?: string
  items: any[]
  selectedCustomer?: any
  onTabChange?: (tab: string) => void
  activeTab?: 'product' | 'customer' | 'prints' | 'payments' | 'orders'
}

const RightPanel: React.FC<RightPanelProps> = ({
  selectedItemId,
  items,
  selectedCustomer,
  onTabChange,
  activeTab: externalActiveTab
}) => {
  const [internalActiveTab, setInternalActiveTab] = useState<
    'product' | 'customer' | 'prints' | 'payments' | 'orders'
  >('product')

  // Use external activeTab if provided, otherwise use internal state
  const activeTab = externalActiveTab || internalActiveTab
  const [subTab, setSubTab] = useState<'orders' | 'returns'>('orders')
  const [customerSubTab, setCustomerSubTab] = useState<'recent' | 'most'>('recent')
  const [productSubTab, setProductSubTab] = useState<'sales-history' | 'customer-history' | 'purchase-history'>(
    'sales-history'
  )
  const [refreshTokens, setRefreshTokens] = useState({
    product: 0,
    customer: 0,
    prints: 0,
    payments: 0,
    orders: 0
  })
  const refreshBypassRef = useRef<{ token?: number; pending?: Set<'recent' | 'most' | 'details'> }>({})
  
  const [currencySymbol, setCurrencySymbol] = useState('$')
  const { profile } = usePOSProfileStore()
  const hideCostAndMargin = profile?.custom_hide_cost_and_margin_info === 1
  const showPurchaseHistory = profile?.custom_show_purchase_history === 1
  
  // Tab configuration - filter based on profile setting
  const productTabs = [
    { id: 'sales-history', label: 'Sales History', color: 'blue' },
    { id: 'customer-history', label: 'Customer History', color: 'emerald' },
    ...(showPurchaseHistory ? [{ id: 'purchase-history', label: 'Purchase History', color: 'purple' }] : [])
  ]
  
  const shouldScrollTabs = productTabs.length >= 4
  
  // If purchase history is disabled and user is on that tab, switch to sales-history
  useEffect(() => {
    if (!showPurchaseHistory && productSubTab === 'purchase-history') {
      console.log('🚫 Purchase History is disabled, switching to Sales History')
      setProductSubTab('sales-history')
    }
  }, [showPurchaseHistory, productSubTab])
  const { updateItemInTab, getCurrentTab, updateTabOrderData, clearAllTabs } = usePOSTabStore()
  const { openTab } = usePOSTabStore()
  const { tabs, setActiveTab } = usePOSTabStore()
  const currentTab = getCurrentTab()
  const [isOpeningOrder, setIsOpeningOrder] = useState(false)
  
  // Function to open order (reusable)
  const handleOpenOrder = async (orderId: string, skipConfirm: boolean = false) => {
    if (!orderId) return
    
    // Check if order is already open
    const existing = tabs.find(t => t.orderId === String(orderId))
    if (existing) {
      setActiveTab(existing.id)
      return
    }
    
    // Show confirmation dialog if not skipping (for sales/customer/recent orders)
    if (!skipConfirm) {
      setPendingOrderData({ orderId, orderName: orderId })
      setShowOpenOrderConfirm(true)
      return
    }
    
    // Open order directly (from orders tab)
    setIsOpeningOrder(true)
    try {
      console.log('📦 Opening order:', orderId)
      const res = await window.electronAPI?.proxy.request({
        url: '/api/method/centro_pos_apis.api.order.get_sales_order_details',
        params: {
          sales_order_id: String(orderId)
        }
      })
      const orderData = res?.data?.data || null
      
      if (orderData) {
        const customerId = orderData.customer || null
        
        // Fetch all related data in parallel
        console.log('📞 API Call: get_customer_details (Order Open)', {
          url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
          params: { customer_id: customerId }
        })
        const [customerDetailsRes, customerInsightsRes, recentOrdersRes, mostOrderedRes] = await Promise.allSettled([
          customerId ? window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
            params: { customer_id: customerId }
          }).then((res) => {
            console.log('📥 API Response: get_customer_details (Order Open)', {
              fullResponse: res,
              data: res?.data,
              customerData: res?.data?.data
            })
            return res
          }) : Promise.resolve(null),
          customerId ? window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
            params: { customer_id: customerId, limit_start: 1, limit_page_length: 4 }
          }) : Promise.resolve(null),
          customerId ? window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
            params: { customer_id: customerId, limit_start: 1, limit_page_length: 3 }
          }) : Promise.resolve(null),
          customerId ? window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products',
            params: { customer_id: customerId, limit_start: 1, limit_page_length: 3 }
          }) : Promise.resolve(null)
        ])
        
        // Fetch sales/purchase history for each item
        const itemHistories = await Promise.allSettled(
          (orderData.items || []).map(async (item: any) => {
            const itemCode = item.item_code || item.item_id
            if (!itemCode) return null
            
            const [salesHistoryRes, purchaseHistoryRes] = await Promise.allSettled([
              window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.product.get_product_sales_history',
                params: { item_id: itemCode, limit_start: 1, limit_page_length: 4 }
              }),
              window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.product.get_product_purchase_history',
                params: { item_id: itemCode, limit_start: 1, limit_page_length: 4 }
              })
            ])
            
            return {
              item_code: itemCode,
              sales_history: salesHistoryRes.status === 'fulfilled' ? salesHistoryRes.value?.data?.data : null,
              purchase_history: purchaseHistoryRes.status === 'fulfilled' ? purchaseHistoryRes.value?.data?.data : null
            }
          })
        )
        
        // Fetch print items
        let printItemsData = null
        try {
          const printRes = await window.electronAPI?.proxy?.request({
            url: '/api/method/centro_pos_apis.api.print.print_items_list',
            params: { order_id: String(orderId) }
          })
          printItemsData = printRes?.data?.data || null
        } catch (printErr) {
          console.warn('⚠️ Failed to fetch print items:', printErr)
        }
        
        const isConfirmed = Number(orderData.docstatus) === 1
        const orderStatus = isConfirmed ? 'confirmed' : 'draft'
        
        // Extract invoice info
        let invoiceNumber = null
        let invoiceStatus = null
        let invoiceCustomReverseStatus = null
        const linkedInvoices = orderData.linked_invoices
        
        if (linkedInvoices) {
          if (Array.isArray(linkedInvoices) && linkedInvoices.length > 0) {
            const firstInvoice = linkedInvoices[0]
            invoiceNumber = firstInvoice?.name || null
            invoiceStatus = firstInvoice?.status || null
            invoiceCustomReverseStatus = firstInvoice?.custom_reverse_status || null
          } else if (linkedInvoices && typeof linkedInvoices === 'object' && !Array.isArray(linkedInvoices)) {
            invoiceNumber = linkedInvoices.name || null
            invoiceStatus = linkedInvoices.status || null
            invoiceCustomReverseStatus = linkedInvoices.custom_reverse_status || null
          }
        }
        
        const enrichedOrderData = {
          ...orderData,
          _relatedData: {
            customerDetails: customerDetailsRes.status === 'fulfilled' ? customerDetailsRes.value?.data?.data : null,
            customerInsights: customerInsightsRes.status === 'fulfilled' ? customerInsightsRes.value?.data?.data : null,
            recentOrders: recentOrdersRes.status === 'fulfilled' ? recentOrdersRes.value?.data?.data : null,
            mostOrdered: mostOrderedRes.status === 'fulfilled' ? mostOrderedRes.value?.data?.data : null,
            itemHistories: itemHistories
              .filter((h: any) => h.status === 'fulfilled' && h.value)
              .map((h: any) => h.value),
            printItems: printItemsData
          }
        }
        
        openTab(String(orderId), enrichedOrderData, orderStatus)
        
        // Update invoice number if available
        if (invoiceNumber) {
          const { updateTabInvoiceNumber } = usePOSTabStore.getState()
          const openedTab = usePOSTabStore.getState().tabs.find(tab => tab.orderId === String(orderId))
          if (openedTab) {
            updateTabInvoiceNumber(openedTab.id, invoiceNumber, invoiceStatus, invoiceCustomReverseStatus)
          }
        }
      } else {
        openTab(String(orderId))
      }
    } catch (e) {
      console.error('Failed to fetch order details:', e)
      openTab(String(orderId))
    } finally {
      setIsOpeningOrder(false)
    }
  }
  
  // Handle confirmed order open
  const handleConfirmOpenOrder = () => {
    if (pendingOrderData) {
      handleOpenOrder(pendingOrderData.orderId, true)
    }
    setShowOpenOrderConfirm(false)
    setPendingOrderData(null)
  }

  // Multi-warehouse popup state
  const [showWarehousePopup, setShowWarehousePopup] = useState(false)
  const [warehousePopupData, setWarehousePopupData] = useState<{
    itemCode: string
    itemName: string
    requiredQty: number
    currentWarehouseQty: number
    warehouses: Array<{
      name: string
      available: number
      allocated: number
      selected: boolean
    }>
    uom?: string
    defaultWarehouse?: string
    itemIndex?: number // Track the index of the item being edited (important for duplicates)
  } | null>(null)

  // Handler function to open split warehouse popup
  const handleOpenSplitWarehouse = () => {
    if (!selectedItemId || warehouseStock.length === 0) {
      toast.error('Please select an item with stock to use Split Wise')
      return
    }
    
    // Find all items with the selected item_code (for duplicate items)
    const matchingItems = items.filter((item: any) => item.item_code === selectedItemId)
    
    if (matchingItems.length === 0) {
      toast.error('Selected item not found')
      return
    }
    
    // If there are multiple items with the same code, we need to find the one that's currently selected
    // Since we don't have row index, we'll use the first one that doesn't have warehouse allocations yet
    // (assuming the user wants to add allocations to the one without them)
    // Otherwise, use the first match
    let selectedItemFromTable = matchingItems[0]
    let selectedItemIndex = items.findIndex((item: any) => item === selectedItemFromTable)
    
    // If there are duplicates, try to find the one without warehouse allocations
    if (matchingItems.length > 1) {
      const itemWithoutAllocations = matchingItems.find((item: any) => 
        !item.warehouseAllocations || 
        !Array.isArray(item.warehouseAllocations) || 
        item.warehouseAllocations.length === 0
      )
      if (itemWithoutAllocations) {
        selectedItemFromTable = itemWithoutAllocations
        selectedItemIndex = items.findIndex((item: any) => item === selectedItemFromTable)
      } else {
        // If all have allocations, use the last one (most recently added)
        selectedItemFromTable = matchingItems[matchingItems.length - 1]
        selectedItemIndex = items.findIndex((item: any) => item === selectedItemFromTable)
      }
    }

    // Get current UOM from selected item
    const currentUom = selectedItemFromTable.uom || 'Nos'
    
    // Check if item already has warehouse allocations (split warehouse state)
    const existingAllocations = selectedItemFromTable.warehouseAllocations && Array.isArray(selectedItemFromTable.warehouseAllocations) 
      ? selectedItemFromTable.warehouseAllocations 
      : []
    
    // Check if this is a non-applied item (no existing allocations)
    const hasNoAllocations = existingAllocations.length === 0
    const enteredQty = Number(selectedItemFromTable.quantity || 0)
    const defaultWarehouseName = profile?.warehouse
    
    // Transform warehouseStock to MultiWarehousePopup format
    const warehouses = warehouseStock.map((warehouse) => {
      // Find quantity for current UOM
      const qtyForUom = warehouse.quantities.find(
        (qtyItem) => qtyItem.uom.toLowerCase() === currentUom.toLowerCase()
      )
      const availableQty = qtyForUom ? Number(qtyForUom.qty) : 0

      // Check if this warehouse has an existing allocation
      const existingAlloc = existingAllocations.find((alloc: any) => alloc.name === warehouse.name)
      
      let isSelected: boolean
      let allocated: number
      
      if (existingAlloc) {
        // Item has existing allocations - use them
        isSelected = true
        allocated = Number(existingAlloc.allocated || 0)
      } else if (hasNoAllocations && defaultWarehouseName && warehouse.name === defaultWarehouseName) {
        // Non-applied item: select default warehouse and set initial quantity
        isSelected = true
        // If entered qty < available in current store, use entered qty; else use max available
        if (enteredQty < availableQty) {
          allocated = enteredQty
        } else {
          allocated = availableQty
        }
      } else {
        // No existing allocation and not the default warehouse
        isSelected = false
        allocated = 0
      }

      return {
        name: warehouse.name,
        available: availableQty,
        allocated: allocated,
        selected: isSelected
      }
    })

    // Filter out warehouses with 0 available stock
    const warehousesWithStock = warehouses.filter((w) => w.available > 0)

    if (warehousesWithStock.length === 0) {
      toast.error('No stock available in warehouses for the current UOM')
      return
    }

    // Open the popup
    setWarehousePopupData({
      itemCode: selectedItemFromTable.item_code,
      itemName: selectedItemFromTable.item_name || selectedItemFromTable.item_code,
      requiredQty: Number(selectedItemFromTable.quantity || 0),
      currentWarehouseQty: warehousesWithStock.reduce((sum, w) => sum + w.available, 0),
      warehouses: warehousesWithStock,
      uom: currentUom,
      defaultWarehouse: profile?.warehouse,
      itemIndex: selectedItemIndex >= 0 ? selectedItemIndex : undefined // Store the item index
    })
    setShowWarehousePopup(true)
  }

  // Ctrl+Shift+W shortcut for split warehouse button
  useHotkeys(
    'ctrl+shift+w',
    (e) => {
      e.preventDefault()
      console.log('⌨️ Ctrl+Shift+W pressed - opening split warehouse popup')
      handleOpenSplitWarehouse()
    },
    { enableOnFormTags: true }
  )

  // Get logout function from useAuthStore
  const { logout } = useAuthStore()

  // Load POS profile data
  const loadPOSProfile = async () => {
    try {
      const response = await window.electronAPI?.proxy.request({
        url: '/api/method/centro_pos_apis.api.profile.get_pos_profile'
      })

      if (response?.data?.data?.custom_currency_symbol) {
        setCurrencySymbol(response.data.data.custom_currency_symbol)
      }
    } catch (error) {
      console.error('Error loading POS profile in RightPanel:', error)
    }
  }

  // Load POS profile on component mount
  useEffect(() => {
    loadPOSProfile()
  }, [])

  // Handle tab change and notify parent
  const handleTabChange = (tab: 'product' | 'customer' | 'prints' | 'payments' | 'orders') => {
    setInternalActiveTab(tab)
    onTabChange?.(tab)
  }

  const triggerTabRefresh = useCallback(
    (tab: 'product' | 'customer' | 'prints' | 'payments' | 'orders') => {
    setRefreshTokens((prev) => {
      const next = {
        ...prev,
        [tab]: prev[tab] + 1
      }
      if (tab === 'customer') {
        refreshBypassRef.current.token = next.customer
        refreshBypassRef.current.pending = new Set(['recent', 'most', 'details'])
      }
      return next
    })
    },
    []
  )
  // Removed global refresh listener to keep right panel untouched by POS refresh

  const resolveCustomerBypass = (section: 'recent' | 'most' | 'details') => {
    if (refreshBypassRef.current.token !== refreshTokens.customer) return
    const pending = refreshBypassRef.current.pending
    if (!pending) return
    pending.delete(section)
    if (pending.size === 0) {
      delete refreshBypassRef.current.token
      delete refreshBypassRef.current.pending
    }
  }


  // Get the currently selected item
  const selectedItem = selectedItemId
    ? items.find((item) => item.item_code === selectedItemId)
    : null
  const currentUom = (selectedItem && (selectedItem.uom || 'Nos')) || 'Nos'

  // Fetch product list data to get on-hand units for selected UOM
  const fetchProductListData = async (itemCode: string) => {
    if (!itemCode) return

    console.log('🔍 Fetching product list data for item:', itemCode)
    setProductListLoading(true)
    try {
      const logApiCall = (
        stage: 'item-get' | 'search-text-get' | 'no-filter-get' | 'item-post',
        method: 'GET' | 'POST',
        paramsOrData: Record<string, unknown>
      ) => {
        console.log('🌐 [ProductListAPI]', {
          stage,
          method,
          payload: paramsOrData
        })
      }

      const tryProductList = async (
        stage: 'item-get' | 'search-text-get' | 'no-filter-get' | 'item-post',
        method: 'GET' | 'POST',
        payload: Record<string, unknown>,
        useParams: boolean
      ) => {
        logApiCall(stage, method, payload)
        const resp = await window.electronAPI?.proxy?.request({
          method,
        url: '/api/method/centro_pos_apis.api.product.product_list',
          ...(useParams ? { params: payload } : { data: payload })
        })
        console.log(`📡 Product list API response (${stage}):`, resp)
        return resp
      }

      const extractList = (resp: any) =>
        Array.isArray(resp?.data?.data) ? resp.data.data : []
      const findProduct = (list: any[]) =>
        list.find((item: any) => item.item_id === itemCode)

      let response = await tryProductList(
        'item-get',
        'GET',
        {
          price_list: 'Standard Selling',
          item: itemCode,
          limit_start: 0,
          limit_page_length: 100
        },
        true
      )
      let list = extractList(response)
      let productData = findProduct(list)

      if (!productData) {
        console.log('🔄 Item not returned via item filter, trying search_text fallback...')
        response = await tryProductList(
          'search-text-get',
          'GET',
          {
          price_list: 'Standard Selling',
          search_text: itemCode,
          limit_start: 0,
            limit_page_length: 100
          },
          true
        )
        list = extractList(response)
        productData = findProduct(list)
      }

      if (!productData) {
        console.log('🔄 Still not found, trying broader fetch without filters...')
        response = await tryProductList(
          'no-filter-get',
          'GET',
          {
            price_list: 'Standard Selling',
            limit_start: 0,
            limit_page_length: 200
          },
          true
        )
        list = extractList(response)
        productData = findProduct(list)
      }

      if (!productData) {
        console.log('🔄 Fallback to POST with item filter...')
        response = await tryProductList(
          'item-post',
          'POST',
          {
            price_list: 'Standard Selling',
            item: itemCode,
            limit_start: 0,
            limit_page_length: 100
          },
          false
        )
        list = extractList(response)
        productData = findProduct(list)
      }

        if (productData) {
          console.log('✅ Product list data set:', productData)
          console.log('📊 UOM details:', productData.uom_details)
        setProductListData(productData)
        } else {
          console.log('❌ No product data found for item:', itemCode)
        console.log('🔍 Available items:', list.map((item: any) => item.item_id))
      }
    } catch (error) {
      console.error('❌ Error fetching product list data:', error)
    } finally {
      setProductListLoading(false)
    }
  }

  // Update on-hand units when selected item or UOM changes
  useEffect(() => {
    if (selectedItemId) {
      fetchProductListData(selectedItemId)
    }
  }, [selectedItemId, currentUom, refreshTokens.product])

  // Fetch customer history for selected product
  // Pagination state for product tab histories
  const [salesHistoryPage, setSalesHistoryPage] = useState(1)
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1)
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1)
  const salesHasMoreRef = useRef(true)
  const customerHasMoreRef = useRef(true)
  const purchaseHasMoreRef = useRef(true)
  const isFetchingSalesRef = useRef(false)
  const isFetchingCustomerRef = useRef(false)
  const isFetchingPurchaseRef = useRef(false)
  const salesHistoryScrollRef = useRef<HTMLDivElement | null>(null)
  const customerHistoryScrollRef = useRef<HTMLDivElement | null>(null)
  const purchaseHistoryScrollRef = useRef<HTMLDivElement | null>(null)

  // Search states - declared early so they can be used in useEffects
  const [salesHistorySearch, setSalesHistorySearch] = useState('')
  const [customerHistorySearch, setCustomerHistorySearch] = useState('')
  const [purchaseHistorySearch, setPurchaseHistorySearch] = useState('')
  const [recentOrdersSearch, setRecentOrdersSearch] = useState('')
  const [mostOrderedSearch, setMostOrderedSearch] = useState('')

  const PAGE_LEN = 3
  const SALES_PAGE_LEN = 4

  const fetchSalesHistory = async (itemCode: string, page = salesHistoryPage, searchTerm: string = '') => {
    if (!itemCode) {
      console.log('🚫 Sales history fetch skipped - missing itemCode:', itemCode)
      return
    }

    console.log('📞 Sales History API called:', {
      itemCode,
      page,
      searchTerm,
      productSubTab,
      selectedItemId,
      timestamp: new Date().toISOString()
    })

    if (isFetchingSalesRef.current) {
      console.log('⚠️ Sales history fetch already in progress, skipping...')
      return
    }
    isFetchingSalesRef.current = true
    setSalesHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_sales_history'
      const apiParams = {
        item_id: itemCode,
        limit_start: page,
        limit_page_length: SALES_PAGE_LEN,
        search_term: searchTerm || '' // Always include search_term
      }

      console.log('📞 Sales History API request params:', apiParams)

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('📦 Sales History API result:', response)

      // Handle nested data structure: response.data.data
      const salesData = response?.data?.data || response?.data
      const dataArray = Array.isArray(salesData) ? salesData : (Array.isArray(response?.data?.data) ? response.data.data : [])

      if (dataArray.length > 0) {
        salesHasMoreRef.current = dataArray.length === SALES_PAGE_LEN
        setSalesHistory(dataArray)
      } else {
        setSalesHistory([])
        salesHasMoreRef.current = false
      }
    } catch (error) {
      console.error('❌ Error loading sales history:', error)
      setSalesHistory([])
      salesHasMoreRef.current = false
    } finally {
      setSalesHistoryLoading(false)
      isFetchingSalesRef.current = false
    }
  }

  const fetchCustomerHistory = async (itemCode: string, page = customerHistoryPage, searchTerm: string = '') => {
    if (!itemCode || !selectedCustomer) {
      console.log('🚫 Customer history fetch skipped - missing itemCode or selectedCustomer:', {
        itemCode,
        selectedCustomer
      })
      return
    }

    // Get the correct customer_id by fetching customer list and finding the matching customer
    let customerId = selectedCustomer.customer_id || selectedCustomer.name

    try {
      console.log('📊 ===== FETCHING CUSTOMER LIST FOR CUSTOMER_ID MAPPING =====')
      const customerListResponse = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: '/api/method/centro_pos_apis.api.customer.customer_list',
        params: {
          search_term: '',
          limit_start: 0,
          limit_page_length: 1000
        }
      })

      if (customerListResponse?.success && customerListResponse?.data?.data) {
        const customers = customerListResponse.data.data
        console.log('📊 Customer list from API:', customers)

        // Find the customer where customer_name matches selectedCustomer.name
        const matchingCustomer = customers.find(
          (c: any) => c.customer_name === selectedCustomer.name
        )
        console.log('📊 Matching customer found:', matchingCustomer)

        if (matchingCustomer) {
          customerId = matchingCustomer.name // This should be the CUS-ID
          console.log('📊 Corrected customer_id from API:', customerId)
        } else {
          console.log('❌ No matching customer found in API response')
        }
      }
    } catch (error) {
      console.error('❌ Error fetching customer list for mapping:', error)
    }

    console.log('📞 Customer History API called:', {
      itemCode,
      customerId,
      page,
      searchTerm,
      productSubTab,
      selectedItemId,
      selectedCustomer: selectedCustomer?.name,
      timestamp: new Date().toISOString()
    })

    if (isFetchingCustomerRef.current) return
    isFetchingCustomerRef.current = true
    setCustomerHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_customer_history'
      const apiParams = {
        item_id: itemCode,
        customer_id: customerId,
        limit_start: page,
        limit_page_length: PAGE_LEN,
        search_term: searchTerm || '' // Always include search_term
      }

      console.log('📞 Customer History API request params:', apiParams)

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('📦 Customer History API result:', response)

      if (response?.success && response?.data?.data) {
        const newData = response.data.data
        // hasMore: if returned fewer than PAGE_LEN, no next page
        customerHasMoreRef.current = Array.isArray(newData) && newData.length === PAGE_LEN
        setCustomerHistory(newData)
      } else {
        setCustomerHistory([])
      }
    } catch (error) {
      console.error('❌ Error loading customer history:', error)
      setCustomerHistory([])
    } finally {
      setCustomerHistoryLoading(false)
      isFetchingCustomerRef.current = false
    }
  }

  // Fetch purchase history for selected product
  const fetchPurchaseHistory = async (itemCode: string, page = purchaseHistoryPage, searchTerm: string = '') => {
    if (!itemCode) {
      console.log('🚫 Purchase history fetch skipped - missing itemCode:', itemCode)
      return
    }

    console.log('📞 Purchase History API called:', {
      itemCode,
      page,
      searchTerm,
      productSubTab,
      selectedItemId,
      timestamp: new Date().toISOString()
    })

    if (isFetchingPurchaseRef.current) return
    isFetchingPurchaseRef.current = true
    setPurchaseHistoryLoading(true)
    try {
      const apiUrl = '/api/method/centro_pos_apis.api.product.get_product_purchase_history'
      const apiParams = {
        item_id: itemCode,
        limit_start: page,
        limit_page_length: PAGE_LEN,
        search_term: searchTerm || '' // Always include search_term
      }

      console.log('📞 Purchase History API request params:', apiParams)

      const response = await window.electronAPI?.proxy?.request({
        method: 'GET',
        url: apiUrl,
        params: apiParams
      })

      console.log('📦 Purchase History API result:', response)

      if (response?.success && response?.data?.data) {
        const newData = response.data.data
        purchaseHasMoreRef.current = Array.isArray(newData) && newData.length === PAGE_LEN
        setPurchaseHistory(newData)
      } else {
        setPurchaseHistory([])
      }
    } catch (error) {
      console.error('❌ Error loading purchase history:', error)
      setPurchaseHistory([])
    } finally {
      setPurchaseHistoryLoading(false)
      isFetchingPurchaseRef.current = false
    }
  }

  // Load history data when product or customer changes
  useEffect(() => {
    console.log('🔄 ===== HISTORY LOADING TRIGGERED =====')
    console.log('🔄 Selected Item ID:', selectedItemId)
    console.log('🔄 Selected Customer:', selectedCustomer)
    console.log('🔄 Customer ID:', selectedCustomer?.customer_id || selectedCustomer?.name)
    console.log('🔄 Current Product Subtab:', productSubTab)

    if (selectedItemId) {
      console.log('🔄 Product/Customer changed, loading history data...')

      // Load histories when product or customer changes
      console.log('🔄 Calling fetchSalesHistory with:', selectedItemId)
      console.log('🔄 Calling fetchCustomerHistory with:', selectedItemId)
      console.log('🔄 Calling fetchPurchaseHistory with:', selectedItemId)
      fetchSalesHistory(selectedItemId, salesHistoryPage, salesHistorySearch)
      fetchCustomerHistory(selectedItemId, customerHistoryPage, customerHistorySearch)
      fetchPurchaseHistory(selectedItemId, purchaseHistoryPage, purchaseHistorySearch)
    } else {
      console.log('🔄 No product selected, clearing history data...')
      // Clear history when no product is selected
      setSalesHistory([])
      setCustomerHistory([])
      setPurchaseHistory([])
    }
    // reset pagination on product or customer change
    setSalesHistoryPage(1)
    setCustomerHistoryPage(1)
    setPurchaseHistoryPage(1)
    salesHasMoreRef.current = true
    customerHasMoreRef.current = true
    purchaseHasMoreRef.current = true
  }, [selectedItemId, selectedCustomer, refreshTokens.product])

  // Reset customer/most pagination when customer tab switches or customer changes
  useEffect(() => {
    setRecentPage(1)
    setRecentHasMore(true)
    setMostPage(1)
    setMostHasMore(true)
  }, [customerSubTab, selectedCustomer?.name])

  // Load history data when subtab changes
  useEffect(() => {
    console.log('🔄 ===== SUBTAB CHANGED =====')
    console.log('🔄 Current Product Subtab:', productSubTab)
    console.log('🔄 Selected Item ID:', selectedItemId)
    console.log('🔄 Selected Customer:', selectedCustomer)

    if (selectedItemId) {
      if (productSubTab === 'sales-history') {
        console.log('🔄 Sales History tab active, fetching sales history...')
        fetchSalesHistory(selectedItemId, salesHistoryPage, salesHistorySearch)
      } else if (productSubTab === 'customer-history') {
        console.log('🔄 Customer History tab active, fetching customer history...')
        fetchCustomerHistory(selectedItemId, customerHistoryPage, customerHistorySearch)
      } else if (productSubTab === 'purchase-history') {
        if (showPurchaseHistory) {
          console.log('🔄 Purchase History tab active, fetching purchase history...')
          fetchPurchaseHistory(selectedItemId, purchaseHistoryPage, purchaseHistorySearch)
        } else {
          console.log('🚫 Purchase History is disabled, switching to Sales History')
          setProductSubTab('sales-history')
        }
      }
    }
  }, [
    productSubTab,
    salesHistoryPage,
    salesHistorySearch,
    customerHistoryPage,
    customerHistorySearch,
    purchaseHistoryPage,
    purchaseHistorySearch,
    selectedItemId,
    refreshTokens.product,
    showPurchaseHistory
  ])

  // Live warehouse stock fetched from backend (for all UOMs)
  const [stockLoading, setStockLoading] = useState(false)
  const [stockError, setStockError] = useState<string | null>(null)
  const [warehouseStock, setWarehouseStock] = useState<{ name: string; quantities: Array<{ uom: string; qty: number }> }[]>([])

  // Product list API data for on-hand units
  const [productListData, setProductListData] = useState<any>(null)
  const [productListLoading, setProductListLoading] = useState(false)
  const [productArabicName, setProductArabicName] = useState<string>('')

  // Unified product data used by the Product tab UI
  const productData = (() => {
    const code = productListData?.item_id || selectedItem?.item_code || ''
    const name = productListData?.item_name || selectedItem?.item_name || ''
    const defaultUom = productListData?.default_uom || 'Nos'
    // Use the selected item's current UOM if available, otherwise use default
    const displayUom = currentUom || defaultUom
    const displayUomKey = String(displayUom || '').trim()
    const selectedUomRates = selectedItem?.uomRates || {}
    const selectedUomMinMax = selectedItem?.uomMinMax || {}
    const uomDetails = Array.isArray(productListData?.uom_details)
      ? productListData.uom_details
      : []
    const rateFromApi = uomDetails.length > 0 ? Number(uomDetails[0]?.rate || 0) : undefined
    // Match the rate for the current display UOM (case-insensitive)
    const matchingUomDetail = uomDetails.find((detail: any) =>
      String(detail?.uom || '').toLowerCase() === String(displayUom || '').toLowerCase()
    )
    const selectedRate = selectedUomRates[displayUomKey] ?? selectedItem?.standard_rate
    const standardRate = Number(
      matchingUomDetail?.rate ??
        selectedRate ??
        rateFromApi ??
        selectedItem?.standard_rate ??
        0
    )
    
    // For margin calculation, use unit price from item table if manually changed, otherwise use API rate
    const marginCalculationRate = Number(
      selectedItem?.standard_rate ??
        selectedRate ??
        matchingUomDetail?.rate ??
        rateFromApi ??
        0
    )
    
    // Calculate on-hand qty for the current UOM (selected item's UOM)
    const onHandQty = (() => {
      if (!uomDetails || uomDetails.length === 0) return 0
      const match = uomDetails.find(
        (d: any) => String(d.uom).toLowerCase() === String(displayUom).toLowerCase()
      )
      return Number(match?.qty || 0)
    })()
    const costPrice = Number(productListData?.cost_price ?? selectedItem?.cost ?? 0)
    // Calculate margin based on unit price from table (if manually changed) or API
    const marginPct = marginCalculationRate > 0 ? ((marginCalculationRate - costPrice) / marginCalculationRate) * 100 : 0
    const minPrice = Number(
      (matchingUomDetail as any)?.min_price ??
        selectedUomMinMax[displayUomKey]?.min ??
        selectedItem?.min_price ??
        0
    )
    const maxPrice = Number(
      (matchingUomDetail as any)?.max_price ??
        selectedUomMinMax[displayUomKey]?.max ??
        selectedItem?.max_price ??
        0
    )

    console.log('🧮 [RightPanel] Pricing info resolved for Product tab:', {
      itemCode: code,
      displayUom: displayUomKey,
      apiRate: matchingUomDetail?.rate,
      cachedRate: selectedRate,
      finalRate: standardRate,
      apiMin: matchingUomDetail?.min_price,
      cachedMin: selectedUomMinMax[displayUomKey]?.min,
      finalMin: minPrice,
      apiMax: matchingUomDetail?.max_price,
      cachedMax: selectedUomMinMax[displayUomKey]?.max,
      finalMax: maxPrice
    })

    return {
      item_code: code,
      item_name: name,
      standard_rate: standardRate,
      min_price: minPrice,
      max_price: maxPrice,
      on_hand: onHandQty,
      on_hand_uom: displayUom, // Include the UOM for display
      cost: costPrice,
      margin: marginPct,
      warehouses: Array.isArray(productListData?.warehouses) ? productListData.warehouses : [],
      category: productListData?.item_group || '',
      location: (productListData as any)?.location || ''
    }
  })()

  // State for item_group and brand from Item resource API
  const [itemGroup, setItemGroup] = useState<string>('')
  const [itemBrand, setItemBrand] = useState<string>('')

  // Fetch Arabic name, item_group, and brand for the selected product
  useEffect(() => {
    const code = productData?.item_code
    if (!code) {
      setProductArabicName('')
      setItemGroup('')
      setItemBrand('')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await window.electronAPI?.proxy.request({
          url: `/api/resource/Item/${code}`
        })
        const itemData = res?.data?.data
        if (!cancelled) {
          setProductArabicName(itemData?.custom_item_name_arabic || '')
          setItemGroup(itemData?.item_group || '')
          setItemBrand(itemData?.brand || '')
        }
      } catch (e) {
        if (!cancelled) {
          setProductArabicName('')
          setItemGroup('')
          setItemBrand('')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [productData?.item_code, refreshTokens.product])

  // Product history states
  const [salesHistory, setSalesHistory] = useState<any[]>([])
  const [customerHistory, setCustomerHistory] = useState<any[]>([])
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([])
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false)
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(false)
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState(false)
  
  // Order open confirmation dialog state (moved before handleOpenOrder to avoid hoisting issues)
  const [showOpenOrderConfirm, setShowOpenOrderConfirm] = useState(false)
  const [pendingOrderData, setPendingOrderData] = useState<{ orderId: string; orderName?: string } | null>(null)
  const openOrderConfirmBtnRef = useRef<HTMLButtonElement>(null)
  const openOrderCancelBtnRef = useRef<HTMLButtonElement>(null)
  
  // Focus confirm button when dialog opens
  useEffect(() => {
    if (showOpenOrderConfirm) {
      setTimeout(() => openOrderConfirmBtnRef.current?.focus(), 0)
    }
  }, [showOpenOrderConfirm])

  // Debounced search effects for product history tabs
  // Sales History search
  const prevSalesSearchRef = useRef<string>('')
  useEffect(() => {
    if (productSubTab !== 'sales-history' || !selectedItemId) return
    if (prevSalesSearchRef.current === salesHistorySearch) return
    
    const handler = setTimeout(() => {
      setSalesHistory([])
      setSalesHistoryPage(1)
      prevSalesSearchRef.current = salesHistorySearch
      fetchSalesHistory(selectedItemId, 1, salesHistorySearch)
    }, 300)
    return () => clearTimeout(handler)
  }, [salesHistorySearch, productSubTab, selectedItemId])

  // Customer History search
  const prevCustomerSearchRef = useRef<string>('')
  useEffect(() => {
    if (productSubTab !== 'customer-history' || !selectedItemId) return
    if (prevCustomerSearchRef.current === customerHistorySearch) return
    
    const handler = setTimeout(() => {
      setCustomerHistory([])
      setCustomerHistoryPage(1)
      prevCustomerSearchRef.current = customerHistorySearch
      fetchCustomerHistory(selectedItemId, 1, customerHistorySearch)
    }, 300)
    return () => clearTimeout(handler)
  }, [customerHistorySearch, productSubTab, selectedItemId])

  // Purchase History search
  const prevPurchaseSearchRef = useRef<string>('')
  useEffect(() => {
    if (productSubTab !== 'purchase-history' || !selectedItemId) return
    if (prevPurchaseSearchRef.current === purchaseHistorySearch) return
    
    const handler = setTimeout(() => {
      setPurchaseHistory([])
      setPurchaseHistoryPage(1)
      prevPurchaseSearchRef.current = purchaseHistorySearch
      fetchPurchaseHistory(selectedItemId, 1, purchaseHistorySearch)
    }, 300)
    return () => clearTimeout(handler)
  }, [purchaseHistorySearch, productSubTab, selectedItemId])

  // Debounced search effects for customer tab - matching Orders pattern
  // Recent Orders search
  const prevRecentOrdersSearchRef = useRef<string>('')
  const isRecentOrdersInitialMount = useRef<boolean>(true)
  const hasRecentOrdersSearchedRef = useRef<boolean>(false) // Track if user has ever searched
  useEffect(() => {
    if (activeTab !== 'customer' || customerSubTab !== 'recent') {
      isRecentOrdersInitialMount.current = true // Reset on tab change
      prevRecentOrdersSearchRef.current = ''
      hasRecentOrdersSearchedRef.current = false // Reset search tracking
      return
    }

    if (!selectedCustomer?.name && !selectedCustomer?.customer_id) {
      isRecentOrdersInitialMount.current = true
      prevRecentOrdersSearchRef.current = ''
      hasRecentOrdersSearchedRef.current = false // Reset search tracking
      return
    }

    // On initial mount or customer change, call API immediately without debounce
    if (isRecentOrdersInitialMount.current) {
      isRecentOrdersInitialMount.current = false
      prevRecentOrdersSearchRef.current = recentOrdersSearch
      setRecentPage(1) // Ensure we start at page 1
      return // Let the main useEffect handle the API call
    }

    // Only debounce if search term actually changed
    if (prevRecentOrdersSearchRef.current === recentOrdersSearch) return
    
    console.log('🔄 Recent Orders search changed, debouncing...', {
      oldSearch: prevRecentOrdersSearchRef.current,
      newSearch: recentOrdersSearch,
      isEmpty: !recentOrdersSearch || recentOrdersSearch.trim() === '',
      currentPage: recentPage
    })
    
    const handler = setTimeout(() => {
      console.log('⏰ Recent Orders debounce timeout, resetting page and clearing results', {
        searchTerm: recentOrdersSearch,
        isEmpty: !recentOrdersSearch || recentOrdersSearch.trim() === ''
      })
      // Mark that user has interacted with search (even if cleared)
      if (prevRecentOrdersSearchRef.current !== recentOrdersSearch) {
        hasRecentOrdersSearchedRef.current = true
      }
      setRecentOrders([]) // Clear previous results
      setRecentPage(1) // Reset to first page
      prevRecentOrdersSearchRef.current = recentOrdersSearch // Update ref after debounce
      // The API call will be triggered by the useEffect above when recentPage or recentOrdersSearch changes
    }, 300) // Debounce for 300ms
    return () => clearTimeout(handler)
  }, [recentOrdersSearch, activeTab, customerSubTab, selectedCustomer?.name, selectedCustomer?.customer_id])

  // Most Ordered search
  const prevMostOrderedSearchRef = useRef<string>('')
  const isMostOrderedInitialMount = useRef<boolean>(true)
  const hasMostOrderedSearchedRef = useRef<boolean>(false) // Track if user has ever searched
  useEffect(() => {
    if (activeTab !== 'customer' || customerSubTab !== 'most') {
      isMostOrderedInitialMount.current = true // Reset on tab change
      prevMostOrderedSearchRef.current = ''
      hasMostOrderedSearchedRef.current = false // Reset search tracking
      return
    }

    if (!selectedCustomer?.name && !selectedCustomer?.customer_id) {
      isMostOrderedInitialMount.current = true
      prevMostOrderedSearchRef.current = ''
      hasMostOrderedSearchedRef.current = false // Reset search tracking
      return
    }

    // On initial mount or customer change, call API immediately without debounce
    if (isMostOrderedInitialMount.current) {
      isMostOrderedInitialMount.current = false
      prevMostOrderedSearchRef.current = mostOrderedSearch
      setMostPage(1) // Ensure we start at page 1
      return // Let the main useEffect handle the API call
    }

    // Only debounce if search term actually changed
    if (prevMostOrderedSearchRef.current === mostOrderedSearch) return
    
    console.log('🔄 Most Ordered search changed, debouncing...', {
      oldSearch: prevMostOrderedSearchRef.current,
      newSearch: mostOrderedSearch,
      isEmpty: !mostOrderedSearch || mostOrderedSearch.trim() === '',
      currentPage: mostPage
    })
    
    const handler = setTimeout(() => {
      console.log('⏰ Most Ordered debounce timeout, resetting page and clearing results', {
        searchTerm: mostOrderedSearch,
        isEmpty: !mostOrderedSearch || mostOrderedSearch.trim() === ''
      })
      // Mark that user has interacted with search (even if cleared)
      if (prevMostOrderedSearchRef.current !== mostOrderedSearch) {
        hasMostOrderedSearchedRef.current = true
      }
      setMostOrdered([]) // Clear previous results
      setMostPage(1) // Reset to first page
      prevMostOrderedSearchRef.current = mostOrderedSearch // Update ref after debounce
      // The API call will be triggered by the useEffect above when mostPage or mostOrderedSearch changes
    }, 300) // Debounce for 300ms
    return () => clearTimeout(handler)
  }, [mostOrderedSearch, activeTab, customerSubTab, selectedCustomer?.name])

  // Orders tab search states
  const [ordersSearch, setOrdersSearch] = useState('')
  const [returnsSearch, setReturnsSearch] = useState('')

  // Recent orders for selected customer
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [recentPage, setRecentPage] = useState(1)
  const [recentHasMore, setRecentHasMore] = useState(true)

  // Most ordered products for selected customer
  const [mostOrdered, setMostOrdered] = useState<any[]>([])
  const [mostLoading, setMostLoading] = useState(false)
  const [mostError, setMostError] = useState<string | null>(null)
  const [mostPage, setMostPage] = useState(1)
  const [mostHasMore, setMostHasMore] = useState(true)
  // Page length controls for customer sub-tabs
  const [recentPageLength, setRecentPageLength] = useState(10)
  const [mostPageLength, setMostPageLength] = useState(10)

  // Customer details and insights
  const [customerDetails, setCustomerDetails] = useState<any>(null)
  const [customerInsights, setCustomerInsights] = useState<any>(null)
  const [customerDetailsLoading, setCustomerDetailsLoading] = useState(false)
  const [customerDetailsError, setCustomerDetailsError] = useState<string | null>(null)

  // Edit customer dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editFormLoading, setEditFormLoading] = useState(false)
  const [editForm, setEditForm] = useState<any>({
    customer_id: '',
    customer_name: '',
    customer_name_arabic: '',
    email: '',
    mobile: '',
    customer_type: 'Individual',
    tax_id: '',
    customer_id_type_for_zatca: '',
    customer_id_number_for_zatca: '',
    address_line1: '',
    address_line2: '',
    building_number: '',
    city: '',
    pincode: '',
    country: ''
  })

  // Orders/Returns lists with pagination
  const [ordersList, setOrdersList] = useState<any[]>([])
  const [returnsList, setReturnsList] = useState<any[]>([])
  const [ordersTabLoading, setOrdersTabLoading] = useState(false)
  const [ordersTabError, setOrdersTabError] = useState<string | null>(null)
  const [ordersPage, setOrdersPage] = useState(1)
  const [returnsPage, setReturnsPage] = useState(1)
  const [pageLength, setPageLength] = useState(10)

  // Profile data and dropdown
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')
  const profileLoading = false

  // Use data directly - server handles all filtering via search_term parameter
  // No client-side filtering needed since API already filters results
  const filteredCustomerHistory = useMemo(() => {
    return customerHistory
  }, [customerHistory])

  const filteredPurchaseHistory = useMemo(() => {
    return purchaseHistory
  }, [purchaseHistory])

  const filteredRecentOrders = useMemo(() => {
    return recentOrders
  }, [recentOrders])

  const filteredMostOrdered = useMemo(() => {
    return mostOrdered
  }, [mostOrdered])

  // Use ordersList directly - server handles filtering via search_term parameter
  // No client-side filtering needed since API already filters results
  const filteredOrders = useMemo(() => {
    return ordersList
  }, [ordersList])

  // Use returnsList directly - server handles filtering via search_term parameter
  // No client-side filtering needed since API already filters results
  const filteredReturns = useMemo(() => {
    return returnsList
  }, [returnsList])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown) {
        const target = event.target as Element
        if (!target.closest('.profile-dropdown')) {
          setShowProfileDropdown(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileDropdown])

  // Load app version on mount for display in profile dropdown
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const api = window.electronAPI?.app
        if (!api?.getVersion) {
          return
        }
        const version = await api.getVersion()
        if (version) {
          setAppVersion(version)
        }
      } catch (error) {
        console.warn('Failed to load app version', error)
      }
    }
    loadVersion()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadStock() {
      if (!selectedItem?.item_code) {
        setWarehouseStock([])
        return
      }
      try {
        setStockLoading(true)
        setStockError(null)
        // Use item_id from productListData if available, otherwise use item_code
        const itemId = productListData?.item_id || selectedItem.item_code
        console.log('🔍 Loading stock for item:')
        console.log('  - selectedItem.item_code:', selectedItem.item_code)
        console.log('  - productListData?.item_id:', productListData?.item_id)
        console.log('  - Using item_id:', itemId)
        console.log('  - Current UOM:', currentUom)
        console.log('🔍 API Call: /api/method/centro_pos_apis.api.product.item_stock_warehouse_list')
        console.log('🔍 API Params:', {
          item_id: itemId,
          search_text: '',
          limit_start: 0,
          limit_page_length: 20
        })
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
          params: {
            item_id: itemId,
            search_text: '',
            limit_start: 0,
            limit_page_length: 20
          }
        })
        console.log('📦 Stock API Response:')
        console.log('  - Full response:', res)
        console.log('  - Response success:', res?.success)
        console.log('  - Response status:', res?.status)
        console.log('  - Response data:', res?.data)
        console.log('  - Response data.data:', res?.data?.data)
        const list = Array.isArray(res?.data?.data) ? res.data.data : []
        console.log('  - Parsed list length:', list.length)
        console.log('  - Parsed list:', list)
        // Store all UOMs and quantities for each warehouse
        const mapped = list.map((w: any) => {
          const q = Array.isArray(w.quantities) ? w.quantities : []
          const quantities = q.map((qq: any) => ({
            uom: String(qq.uom || ''),
            qty: Number(qq.qty || 0)
          })).filter((qty: any) => qty.qty > 0) // Only show UOMs with quantity > 0
          return { 
            name: w.warehouse, 
            quantities: quantities
          }
        }).filter((w: any) => w.quantities.length > 0) // Only show warehouses with stock
        console.log('🗂️ Mapped warehouses with all UOMs:', mapped)
        if (!cancelled)
          setWarehouseStock(mapped)

          // Add test command to window for debugging
        ;(window as any).testStockAPI = async (itemCode: string) => {
          try {
            const res = await window.electronAPI?.proxy?.request({
              url: '/api/method/centro_pos_apis.api.product.item_stock_warehouse_list',
              params: {
                item_id: itemCode,
                search_text: '',
                limit_start: 0,
                limit_page_length: 20
              }
            })
            console.log('🧪 Test API result:', res)
            return res
          } catch (e) {
            console.error('🧪 Test API error:', e)
            return e
          }
        }
      } catch (e: any) {
        console.error('❌ Stock loading error:', e)
        if (!cancelled) setStockError(e?.message || 'Failed to load stock')
      } finally {
        if (!cancelled) setStockLoading(false)
      }
    }
    loadStock()
    return () => {
      cancelled = true
    }
  }, [selectedItem?.item_code, productListData?.item_id, refreshTokens.product])

  // Fetch recent orders when customer is selected - matching Orders pattern
  useEffect(() => {
    console.log('🔄 Recent Orders useEffect triggered:', {
      recentPage,
      recentOrdersSearch,
      activeTab,
      customerSubTab,
      selectedCustomer: selectedCustomer?.name || selectedCustomer?.customer_id,
      selectedCustomerFull: selectedCustomer,
      timestamp: new Date().toISOString()
    });
    const bypassPrefetch =
      refreshBypassRef.current.token === refreshTokens.customer &&
      refreshBypassRef.current.pending?.has('recent')
    let cancelled = false;
    async function loadRecentOrders(page: number, searchTerm: string = '') {
      const PAGE_LEN_LOCAL = recentPageLength
      console.log('📞 Recent Orders API called:', {
        page,
        searchTerm,
        activeTab,
        customerSubTab,
        selectedCustomer: selectedCustomer?.name || selectedCustomer?.customer_id,
        selectedCustomerFull: selectedCustomer,
        timestamp: new Date().toISOString()
      });
      if (!selectedCustomer) {
        console.log('🚫 Recent Orders: No selected customer, skipping API call')
        setRecentOrders([])
        return
      }
      
      // Check if we have pre-fetched data from order opening (only for page 1, no search, and never searched)
      // Skip pre-fetched data if user has ever searched (even if cleared) to ensure fresh API call
      const shouldUsePreFetched = page === 1 && !searchTerm && recentOrdersSearch === '' && !hasRecentOrdersSearchedRef.current
      if (shouldUsePreFetched) {
        const preFetched = currentTab?.orderData?._relatedData
        if (preFetched?.recentOrders && !bypassPrefetch) {
          console.log('✅ Using pre-fetched recent orders from order')
          if (!cancelled) {
            const orders = Array.isArray(preFetched.recentOrders) ? preFetched.recentOrders : []
            setRecentOrders(orders)
            setRecentHasMore(orders.length === PAGE_LEN)
            setOrdersLoading(false)
          }
          return
        }
      }
      
      // If search term is empty or was cleared, ensure we call API
      if (!searchTerm || searchTerm.trim() === '') {
        console.log('🔄 Calling API with empty search term (search cleared or no search)', {
          hasSearchedBefore: hasRecentOrdersSearchedRef.current
        })
      }
      
      try {
        setOrdersLoading(true)
        setOrdersError(null)

        // Resolve customer_id via customer list API
        console.log('📞 Recent Orders: Resolving customer_id via customer list API...')
        const customerListRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: {
            search_term: '',
            limit_start: 1,
            limit_page_length: 50
          }
        })

        const customers = customerListRes?.data?.data || []
        const matchingCustomer = customers.find(
          (c: any) => c.customer_name === selectedCustomer.name
        )

        if (!matchingCustomer) {
          console.log('❌ Recent Orders: Customer not found in system')
          setOrdersError('Customer not found in system')
          return
        }

        const customerId = matchingCustomer.name
        const recentOrdersParams = {
          customer_id: customerId,
          limit_start: page,
          limit_page_length: PAGE_LEN_LOCAL,
          search_term: searchTerm || '' // Always include search_term
        }
        const apiUrl = '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders'
        console.log('📞 Recent Orders API Call:')
        console.log('   URL:', apiUrl)
        console.log('   Params:', JSON.stringify(recentOrdersParams, null, 2))
        console.log('   Full Request:', { url: apiUrl, params: recentOrdersParams })

        const res = await window.electronAPI?.proxy?.request({
          url: apiUrl,
          params: recentOrdersParams
        })
        console.log('📦 Recent Orders API Response:')
        console.log('   Status:', res?.status)
        console.log('   Success:', res?.success)
        console.log('   Data:', res?.data)
        console.log('   Full Response:', res)

          if (!cancelled) {
          const actualData = res?.data?.data || res?.data
          const orders = Array.isArray(actualData) ? actualData : []
            if (orders.length === 0) {
              setRecentHasMore(false)
              if (page > 1) setRecentPage(page - 1)
              return
            }
            setRecentHasMore(orders.length === PAGE_LEN_LOCAL)
            setRecentOrders(orders)

            if (orders.length === PAGE_LEN_LOCAL) {
              try {
                const probe = await window.electronAPI?.proxy?.request({
                  url: '/api/method/centro_pos_apis.api.customer.get_customer_recent_orders',
                params: { 
                  customer_id: customerId, 
                  limit_start: page + 1, 
                  limit_page_length: PAGE_LEN_LOCAL,
                  search_term: searchTerm || '' // Always include search_term
                }
                })
                const nextItems = Array.isArray(probe?.data?.data) ? probe.data.data : []
                setRecentHasMore(nextItems.length > 0)
              } catch (_) {
                // If probe fails, keep previous hasMore assumption
              }
          }
        }
      } catch (err) {
        console.error('❌ Error loading recent orders:', err)
        if (!cancelled) {
          setOrdersError(err instanceof Error ? err.message : 'Failed to load recent orders')
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false)
        }
      }
    }
    if (activeTab === 'customer' && customerSubTab === 'recent' && (selectedCustomer?.name || selectedCustomer?.customer_id)) {
      void loadRecentOrders(recentPage, recentOrdersSearch).finally(() => resolveCustomerBypass('recent'))
    } else if (bypassPrefetch) {
      resolveCustomerBypass('recent')
    }
    return () => {
      cancelled = true;
    };
  }, [
    recentPage,
    activeTab,
    customerSubTab,
    recentOrdersSearch,
    selectedCustomer?.name,
    selectedCustomer?.customer_id,
    currentTab?.orderId,
    refreshTokens.customer,
    recentPageLength
  ])

  // Fetch most ordered when customer is selected - matching Orders pattern
  useEffect(() => {
    console.log('🔄 Most Ordered useEffect triggered:', {
      mostPage,
      mostOrderedSearch,
      activeTab,
      customerSubTab,
      selectedCustomer: selectedCustomer?.name || selectedCustomer?.customer_id,
      selectedCustomerFull: selectedCustomer,
      timestamp: new Date().toISOString()
    });
    const bypassPrefetch =
      refreshBypassRef.current.token === refreshTokens.customer &&
      refreshBypassRef.current.pending?.has('most')
    let cancelled = false;
    async function loadMostOrdered(page: number, searchTerm: string = '') {
      const PAGE_LEN_LOCAL = mostPageLength
      console.log('📞 Most Ordered API called:', {
        page,
        searchTerm,
        activeTab,
        customerSubTab,
        selectedCustomer: selectedCustomer?.name || selectedCustomer?.customer_id,
        selectedCustomerFull: selectedCustomer,
        timestamp: new Date().toISOString()
      });
      if (!selectedCustomer) {
        console.log('🚫 Most Ordered: No selected customer, skipping API call')
        setMostOrdered([])
        return
      }
      
      // Check if we have pre-fetched data from order opening (only for page 1, no search, and never searched)
      // Skip pre-fetched data if user has ever searched (even if cleared) to ensure fresh API call
      const shouldUsePreFetched = page === 1 && !searchTerm && mostOrderedSearch === '' && !hasMostOrderedSearchedRef.current
      if (shouldUsePreFetched) {
        const preFetched = currentTab?.orderData?._relatedData
        if (preFetched?.mostOrdered && !bypassPrefetch) {
          console.log('✅ Using pre-fetched most ordered from order')
          if (!cancelled) {
            const items = Array.isArray(preFetched.mostOrdered) ? preFetched.mostOrdered : []
            setMostOrdered(items)
            setMostHasMore(items.length === mostPageLength)
            setMostLoading(false)
          }
          return
        }
      }
      
      // If search term is empty or was cleared, ensure we call API
      if (!searchTerm || searchTerm.trim() === '') {
        console.log('🔄 Calling API with empty search term (search cleared or no search)', {
          hasSearchedBefore: hasMostOrderedSearchedRef.current
        })
      }
      
      try {
        setMostLoading(true)
        setMostError(null)
        // Resolve customer_id via customer list API
        console.log('📞 Most Ordered: Resolving customer_id via customer list API...')
        const listRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: { search_term: '', limit_start: 1, limit_page_length: 50 }
        })
        const list = listRes?.data?.data || []
        const match = list.find((c: any) => c.customer_name === selectedCustomer.name)
        const customerId = match?.name
        if (!customerId) {
          console.log('❌ Most Ordered: Customer not found in system')
          setMostOrdered([])
          return
        }
        const mostOrderedParams = {
          customer_id: customerId, 
          limit_start: page, 
          limit_page_length: PAGE_LEN_LOCAL,
          search_term: searchTerm || '' // Always include search_term
        }
        const apiUrl = '/api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products'
        console.log('📞 Most Ordered API Call:')
        console.log('   URL:', apiUrl)
        console.log('   Params:', JSON.stringify(mostOrderedParams, null, 2))
        console.log('   Full Request:', { url: apiUrl, params: mostOrderedParams })

        const res = await window.electronAPI?.proxy?.request({
          url: apiUrl,
          params: mostOrderedParams
        })
        console.log('📦 Most Ordered API Response:')
        console.log('   Status:', res?.status)
        console.log('   Success:', res?.success)
        console.log('   Data:', res?.data)
        console.log('   Full Response:', res)
        if (!cancelled) {
          const actualData = res?.data?.data || res?.data
          const items = Array.isArray(actualData) ? actualData : []
          if (items.length === 0) {
            setMostHasMore(false)
            if (page > 1) setMostPage(page - 1)
            return
          }
            setMostHasMore(items.length === PAGE_LEN_LOCAL)
          setMostOrdered(items)

          if (items.length === PAGE_LEN_LOCAL) {
            try {
              const probe = await window.electronAPI?.proxy?.request({
                url: '/api/method/centro_pos_apis.api.customer.get_customer_most_ordered_products',
                params: { 
                  customer_id: customerId, 
                  limit_start: page + 1, 
                  limit_page_length: PAGE_LEN_LOCAL,
                  search_term: searchTerm || '' // Always include search_term
                }
              })
              const nextItems = Array.isArray(probe?.data?.data) ? probe.data.data : []
              setMostHasMore(nextItems.length > 0)
            } catch (_) {
              // ignore probe failure
            }
          }
        }
      } catch (e: any) {
        console.error('❌ Error loading most ordered:', e)
        if (!cancelled) setMostError(e?.message || 'Failed to load most ordered')
      } finally {
        if (!cancelled) setMostLoading(false)
      }
    }
    if (activeTab === 'customer' && customerSubTab === 'most' && (selectedCustomer?.name || selectedCustomer?.customer_id)) {
      void loadMostOrdered(mostPage, mostOrderedSearch).finally(() => resolveCustomerBypass('most'))
    } else if (bypassPrefetch) {
      resolveCustomerBypass('most')
    }
    return () => {
      cancelled = true;
    };
  }, [
    mostPage,
    activeTab,
    customerSubTab,
    mostOrderedSearch,
    selectedCustomer?.name,
    selectedCustomer?.customer_id,
    currentTab?.orderId,
    refreshTokens.customer,
    mostPageLength
  ])

  // Track previous active tab to detect tab switches
  const prevActiveTabRef = useRef<string | null>(null)
  
  // Fetch customer details and insights when customer is selected
  useEffect(() => {
    console.log('🔄 Customer details useEffect triggered:', {
      activeTab,
      selectedCustomer: selectedCustomer?.name,
      currentTabOrderId: currentTab?.orderId,
      currentTabStatus: currentTab?.status,
      refreshToken: refreshTokens.customer
    })
    
    // Only fetch when customer tab is active
    if (activeTab !== 'customer') {
      prevActiveTabRef.current = activeTab
      return
    }
    
    let cancelled = false
    const bypassPrefetch =
      refreshBypassRef.current.token === refreshTokens.customer &&
      refreshBypassRef.current.pending?.has('details')
    
    // Check if order status changed - if so, bypass cache to get fresh insights
    // Also bypass if orderId changed (order was just saved)
    // Also bypass cache when switching to customer tab to always get fresh data
    const lastKnownStatus = (currentTab?.orderData as any)?._lastKnownStatus
    const lastKnownOrderId = (currentTab?.orderData as any)?._lastKnownOrderId
    const orderStatusChanged = lastKnownStatus !== undefined && currentTab?.status && currentTab.status !== lastKnownStatus
    const orderIdChanged = lastKnownOrderId !== undefined && currentTab?.orderId && currentTab.orderId !== lastKnownOrderId
    const justSwitchedToCustomer = prevActiveTabRef.current !== 'customer' && activeTab === 'customer'
    const shouldBypassCache = bypassPrefetch || orderStatusChanged || orderIdChanged || justSwitchedToCustomer
    
    // Update ref for next comparison
    prevActiveTabRef.current = activeTab
    
    async function loadCustomerDetails() {
      if (!selectedCustomer) {
        console.log('⚠️ No customer selected, clearing details')
        setCustomerDetails(null)
        setCustomerInsights(null)
        setCustomerDetailsLoading(false)
        resolveCustomerBypass('details')
        return
      }
      
      console.log('🔄 Loading customer details for:', selectedCustomer.name, {
        shouldBypassCache,
        bypassPrefetch,
        orderStatusChanged,
        orderIdChanged,
        justSwitchedToCustomer
      })
      
      // Check if we have pre-fetched data from order opening
      // Skip cache if order status changed (save/confirm/pay/return happened)
      // Always bypass cache when switching to customer tab to get fresh insights
      const preFetched = currentTab?.orderData?._relatedData
      
      if ((preFetched?.customerDetails || preFetched?.customerInsights) && !shouldBypassCache) {
        console.log('✅ Using pre-fetched customer data from order')
        if (!cancelled) {
          setCustomerDetails(preFetched.customerDetails || null)
          setCustomerInsights(preFetched.customerInsights || null)
          setCustomerDetailsLoading(false)
          
          // Set _lastKnownStatus and _lastKnownOrderId so we can detect changes later
          if (currentTab?.id && currentTab?.orderData && !(currentTab.orderData as any)?._lastKnownStatus) {
            const updatedOrderData = {
              ...currentTab.orderData,
              _lastKnownStatus: currentTab.status,
              _lastKnownOrderId: currentTab.orderId
            }
            updateTabOrderData(currentTab.id, updatedOrderData)
          }
        }
        resolveCustomerBypass('details')
        return
      }
      
      // If we reach here, we need to fetch fresh data
      console.log('🔄 Fetching fresh customer details (bypassing cache)')
      
      if (justSwitchedToCustomer) {
        console.log('🔄 Just switched to customer tab, fetching fresh insights')
      }
      
      // If we should bypass cache, clear cached insights from orderData
      if (shouldBypassCache && currentTab?.orderData?._relatedData) {
        console.log('🔄 Bypassing cache, clearing cached customer insights', {
          bypassPrefetch,
          orderStatusChanged,
          orderIdChanged,
          justSwitchedToCustomer
        })
        const updatedOrderData = {
          ...currentTab.orderData,
          _relatedData: {
            ...currentTab.orderData._relatedData,
            customerInsights: null,
            customerDetails: null
          }
        }
        updateTabOrderData(currentTab.id, updatedOrderData)
      }
      
      try {
        setCustomerDetailsLoading(true)
        setCustomerDetailsError(null)

        // Step 1: Get customer ID from customer list
        const listRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_list',
          params: { search_term: '', limit_start: 1, limit_page_length: 50 }
        })
        const list = listRes?.data?.data || []
        const match = list.find((c: any) => c.customer_name === selectedCustomer.name)
        const customerId = match?.name

        if (!customerId) {
          console.log('❌ Customer ID not found for:', selectedCustomer.name)
          setCustomerDetails(null)
          setCustomerInsights(null)
          setCustomerDetailsLoading(false)
          resolveCustomerBypass('details')
          return
        }
        
        console.log('✅ Found customer ID:', customerId, 'for customer:', selectedCustomer.name)

        // Step 2: Fetch customer details
        console.log('📞 API Call: get_customer_details', {
          url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
          params: { customer_id: customerId }
        })
        const detailsRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
          params: { customer_id: customerId }
        })
        console.log('📥 API Response: get_customer_details', {
          fullResponse: detailsRes,
          data: detailsRes?.data,
          customerData: detailsRes?.data?.data
        })

        // Step 3: Fetch customer insights
        const insightsRes = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.customer.customer_amount_insights',
          params: { customer_id: customerId }
        })

        if (!cancelled) {
          const details = detailsRes?.data?.data || null
          const insights = insightsRes?.data?.data || null
          console.log('✅ Customer details loaded:', { 
            hasDetails: !!details, 
            hasInsights: !!insights,
            customerName: details?.customer_name || selectedCustomer.name
          })
          setCustomerDetails(details)
          setCustomerInsights(insights)
          
          // Update orderData with fresh insights and track status/orderId
          if (currentTab?.id && currentTab?.orderData) {
            const updatedOrderData = {
              ...currentTab.orderData,
              _relatedData: {
                ...currentTab.orderData._relatedData,
                customerInsights: insightsRes?.data?.data || null,
                customerDetails: detailsRes?.data?.data || null
              },
              _lastKnownStatus: currentTab.status,
              _lastKnownOrderId: currentTab.orderId
            }
            updateTabOrderData(currentTab.id, updatedOrderData)
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setCustomerDetailsError(e?.message || 'Failed to load customer details')
        }
      } finally {
        if (!cancelled) {
          setCustomerDetailsLoading(false)
        }
        resolveCustomerBypass('details')
      }
    }
    void loadCustomerDetails()
    return () => {
      cancelled = true
    }
  }, [selectedCustomer?.name, currentTab?.orderId, currentTab?.status, refreshTokens.customer, activeTab])

  // PATCH 1: Add page size state
  const pageSizeOptions = [10, 25, 50];

  // PATCH 2: Refetch and reset page on pageLength change
  useEffect(() => {
    setOrdersPage(1);
  }, [pageLength]);
  useEffect(() => {
    setReturnsPage(1);
  }, [pageLength]);

  // PATCH 3: Console.log API responses, use limit_start = page
  useEffect(() => {
    console.log('🔄 Orders useEffect triggered:', {
      ordersPage,
      ordersSearch,
      pageLength,
      activeTab,
      subTab,
      timestamp: new Date().toISOString()
    });
    let cancelled = false;
    async function loadOrdersPaginated(page: number, searchTerm: string = '') {
      console.log('📞 Orders API called:', {
        page,
        searchTerm,
        pageLength,
        activeTab,
        subTab,
        timestamp: new Date().toISOString()
      });
      try {
        setOrdersTabLoading(true);
        setOrdersTabError(null);
        const ordersParams = {
            is_returned: 0,
            limit_start: page,
          limit_page_length: pageLength,
          search_term: searchTerm || '' // Always include search_term
        };
        console.log('📞 Orders API request params:', ordersParams);
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.order_list',
          params: ordersParams,
        });
        console.log('📦 Orders API result:', res);
        if (!cancelled) {
          // Handle nested data structure: response.data.data or response.data
          const actualData = res?.data?.data || res?.data
          const data = Array.isArray(actualData) ? actualData : [];
          setOrdersList(data);
          // Store total (API: res.data.total or data.length fallback)
          setOrdersTotal(typeof res?.data?.total === 'number' ? res.data.total : data.length);
        }
      } catch (err) {
        if (!cancelled) setOrdersTabError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        if (!cancelled) setOrdersTabLoading(false);
        }
      }
    if (activeTab === 'orders' && subTab === 'orders') {
      loadOrdersPaginated(ordersPage, ordersSearch);
    }
    return () => {
      cancelled = true;
    };
  }, [ordersPage, pageLength, activeTab, subTab, ordersSearch, refreshTokens.orders]); // Added ordersSearch to dependencies

  // Debounced search effect - resets pagination and triggers API call when search changes
  const prevSearchRef = useRef<string>('');
  const isInitialMount = useRef<boolean>(true);

  useEffect(() => {
    if (activeTab !== 'orders' || subTab !== 'orders') {
      isInitialMount.current = true; // Reset on tab change
      prevSearchRef.current = '';
      return;
    }

    // On initial mount or tab switch, call API immediately without debounce
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevSearchRef.current = ordersSearch;
      setOrdersPage(1); // Ensure we start at page 1
      return; // Let the main useEffect handle the API call
    }

    // Only debounce if search term actually changed
    if (prevSearchRef.current === ordersSearch) return;
    
    const handler = setTimeout(() => {
      prevSearchRef.current = ordersSearch; // Update ref after debounce
      setOrdersPage((prev) => (prev === 1 ? prev : 1)); // Reset to first page if needed
      // The API call will be triggered by the useEffect above when dependencies change
    }, 300); // Debounce for 300ms

    return () => {
      clearTimeout(handler);
    };
  }, [ordersSearch, activeTab, subTab]); // Trigger when search term changes

  useEffect(() => {
    console.log('🔄 Returns useEffect triggered:', {
      returnsPage,
      returnsSearch,
      pageLength,
      activeTab,
      subTab,
      timestamp: new Date().toISOString()
    });
    let cancelled = false;
    async function loadReturnsPaginated(page: number, searchTerm: string = '') {
      console.log('📞 Returns API called:', {
        page,
        searchTerm,
        pageLength,
        activeTab,
        subTab,
        timestamp: new Date().toISOString()
      });
      try {
        setOrdersTabLoading(true);
        setOrdersTabError(null);
        const returnsParams = {
            is_returned: 1,
            limit_start: page,
          limit_page_length: pageLength,
          search_term: searchTerm || '' // Always include search_term
        };
        console.log('📞 Returns API request params:', returnsParams);
        const res = await window.electronAPI?.proxy?.request({
          url: '/api/method/centro_pos_apis.api.order.order_list',
          params: returnsParams,
        });
        console.log('📦 Returns API result:', res);
        if (!cancelled) {
          // Handle nested data structure: response.data.data or response.data
          const actualData = res?.data?.data || res?.data
          const data = Array.isArray(actualData) ? actualData : [];
          setReturnsList(data);
          setReturnsTotal(typeof res?.data?.total === 'number' ? res.data.total : data.length);
        }
      } catch (err) {
        if (!cancelled) setOrdersTabError(err instanceof Error ? err.message : 'Failed to load returns');
      } finally {
        if (!cancelled) setOrdersTabLoading(false);
        }
      }
    if (activeTab === 'orders' && subTab === 'returns') {
      loadReturnsPaginated(returnsPage, returnsSearch);
    }
    return () => {
      cancelled = true;
    };
  }, [returnsPage, pageLength, activeTab, subTab, returnsSearch, refreshTokens.orders]); // Added returnsSearch to dependencies

  // Debounced search effect for Returns - resets pagination and triggers API call when search changes
  const prevReturnsSearchRef = useRef<string>('');
  const isReturnsInitialMount = useRef<boolean>(true);
  
  useEffect(() => {
    if (activeTab !== 'orders' || subTab !== 'returns') {
      isReturnsInitialMount.current = true; // Reset on tab change
      prevReturnsSearchRef.current = '';
      return;
    }

    // On initial mount or tab switch, call API immediately without debounce
    if (isReturnsInitialMount.current) {
      isReturnsInitialMount.current = false;
      prevReturnsSearchRef.current = returnsSearch;
      setReturnsPage(1); // Ensure we start at page 1
      return; // Let the main useEffect handle the API call
    }

    // Only debounce if search term actually changed
    if (prevReturnsSearchRef.current === returnsSearch) return;
    
    const handler = setTimeout(() => {
      prevReturnsSearchRef.current = returnsSearch; // Update ref after debounce
      setReturnsPage((prev) => (prev === 1 ? prev : 1)); // Reset to first page if needed
      // The API call will be triggered by the useEffect above when dependencies change
    }, 300); // Debounce for 300ms

    return () => {
      clearTimeout(handler);
    };
  }, [returnsSearch, activeTab, subTab, refreshTokens.orders]); // Trigger when search term changes

  // PATCH 5: Show total state for orders/returns
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [returnsTotal, setReturnsTotal] = useState(0);

  // PATCH 6: Add dropdown and show total above each list
  // ... in the JSX for Orders list, above the result count ...
  <div className="flex items-center justify-between mb-2">
    <span className="text-xs text-gray-500">{ordersTotal} results found</span>
    <select
      value={pageLength}
      onChange={e => setPageLength(Number(e.target.value))}
      className="text-xs border rounded px-2 py-1"
    >
      {pageSizeOptions.map(opt => (
        <option key={opt} value={opt}>{opt} / page</option>
      ))}
    </select>
  </div>
  // ... and similarly for Returns list, use returnsTotal.

  return (
    <div className="w-[480px] bg-white/60 backdrop-blur border-l border-white/20 flex flex-col overflow-y-auto scrollbar-hide">
      <div className="flex justify-end border-b border-gray-200/60 bg-white/80 pl-2 pr-2">
        <button
          className={`px-4 py-3 font-semibold text-sm border-b-3 ${
            activeTab === 'product'
              ? 'border-accent bg-white/90 text-accent'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('product')}
        >
          Product
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'customer'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('customer')}
        >
          Customer
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'prints'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('prints')}
        >
          Prints
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'payments'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('payments')}
        >
          Payments
        </button>
        <button
          className={`px-4 py-3 font-medium text-sm border-b-3 ${
            activeTab === 'orders'
              ? 'border-accent bg-white/90 text-accent font-semibold'
              : 'border-transparent text-gray-500 hover:text-black hover:bg-white/40 transition-all'
          }`}
          onClick={() => handleTabChange('orders')}
        >
          Orders
        </button>

        {/* Profile Circle */}
        <div className="relative ml-2 mr-2 flex items-center">
          <button
            className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
          >
            {profileLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : profile?.name ? (
              profile.name.substring(0, 2).toUpperCase()
            ) : (
              'U'
            )}
          </button>

          {/* Profile Dropdown */}
          {showProfileDropdown && (
            <div
              className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="text-sm font-semibold text-gray-800">
                  {profile?.name || 'User Profile'}
                </div>
                {appVersion && (
                  <div className="text-xs text-gray-500 mt-1">
                    Version {appVersion}
                  </div>
                )}
              </div>
              <button
                className="w-full px-4 py-2 text-left text-sm font-semibold text-black hover:bg-gray-100 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('=== DROPDOWN LOGOUT BUTTON MOUSE DOWN ===')
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  console.log('=== DROPDOWN LOGOUT BUTTON CLICKED ===')

                  // Don't close dropdown immediately - let logout handle it

                  const performLogout = async () => {
                    try {
                      // Clear the auth store
                      console.log('1. Calling logout from store...')
                      logout()
                      console.log('2. Store logout completed')

                      // Also clear the proxy session
                      console.log('3. Calling proxy logout...')
                      await window.electronAPI?.proxy?.logout()
                      console.log('4. Proxy logout completed')

                      // Clear POS tab state and authentication data
                      console.log('5. Clearing POS tab state...')
                      clearAllTabs()
                      localStorage.removeItem('pos-tab-store')
                      const tabStorePersist = (usePOSTabStore as any).persist
                      if (tabStorePersist?.clearStorage) {
                        await tabStorePersist.clearStorage()
                      }
                      console.log('6. POS tab state cleared')

                      console.log('7. Clearing authentication data...')
                      localStorage.removeItem('userData')
                      localStorage.removeItem('auth-store')
                      console.log('8. Authentication data cleared')

                      // Close dropdown
                      setShowProfileDropdown(false)
                      console.log('9. Dropdown closed')

                      // FORCE reload to login page
                      console.log('10. Reloading page to login...')
                      window.location.href = '/'
                      console.log('11. Page reload initiated')
                    } catch (error) {
                      console.error('=== DROPDOWN LOGOUT FAILED ===', error)
                      // Force reload even if logout fails
                      console.log('Fallback: Force reloading page...')
                      setShowProfileDropdown(false)
                      localStorage.removeItem('userData')
                      localStorage.removeItem('auth-store')
                      clearAllTabs()
                      localStorage.removeItem('pos-tab-store')
                      const tabStorePersistFallback = (usePOSTabStore as any).persist
                      if (tabStorePersistFallback?.clearStorage) {
                        await tabStorePersistFallback.clearStorage()
                      }
                      window.location.href = '/'
                    }
                  }

                  // Execute logout
                  performLogout()
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'product' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {!selectedItem ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  Select an item to view details
                </h3>
                <p className="text-sm text-gray-500">
                  Choose a product from the items table to see pricing, stock, and other
                  information.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Product Overview */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <div className="flex">
                  <div className="w-32 h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-4 flex items-center justify-center">
                    <div className="w-24 h-24 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold">
                      {productData.item_code.substring(0, 3).toUpperCase()}
                    </div>
                  </div>
                  <div className="space-y-2 ml-4 flex-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-lg text-gray-500">{productData.item_code}</div>
                      <button
                        type="button"
                        onClick={() => triggerTabRefresh('product')}
                        className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                        title="Refresh product data"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="font-semibold text-sm text-gray-800">{productData.item_name}</div>
                    {productArabicName && (
                      <div className="text-xs text-gray-700">{productArabicName}</div>
                    )}
                    {itemGroup && (
                      <div className="text-sm text-gray-600">Group: {itemGroup}</div>
                    )}
                    {itemBrand && (
                      <div className="text-sm text-gray-600">Brand: {itemBrand}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <h4 className="font-bold text-gray-800 mb-3">Pricing & Stock</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-xs text-gray-600">Unit Price</div>
                    <div className="font-bold text-blue-600">
                      {currencySymbol} {productData.standard_rate.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50/40 rounded-xl">
                    <div className="space-y-1">
                      <div className="text-sm">
                        <span className="text-gray-600">Min Price: </span>
                        <span className="font-bold text-purple-600">
                          {currencySymbol} {productData.min_price.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-600">Max Price: </span>
                        <span className="font-bold text-blue-600">
                          {currencySymbol} {productData.max_price.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!hideCostAndMargin && (
                    <>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Cost</div>
                    <div className="font-bold text-orange-600">
                      {currencySymbol} {productData.cost.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Margin</div>
                    <div className="font-bold text-purple-600">
                      {productData.margin.toFixed(1)}%
                    </div>
                  </div>
                    </>
                  )}
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl col-span-2">
                    <div className="text-xs text-gray-600">On Hand</div>
                    {productListLoading ? (
                      <div className="font-bold text-gray-500">Loading...</div>
                    ) : (
                      <div className="font-bold text-red-600">{productData.on_hand} {productData.on_hand_uom || 'units'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock Details */}
              <div className="p-4 border-b border-gray-200/60 bg-white/90">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-gray-800">Stock Details</h4>
                  <Button
                    type="button"
                    onClick={handleOpenSplitWarehouse}
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-2"
                    disabled={!selectedItemId || warehouseStock.length === 0}
                  >
                    Split Wise
                    <span className="text-xs opacity-80 bg-white/20 px-2 py-1 rounded-lg">Ctrl+Shift+W</span>
                  </Button>
                </div>
                <div className="space-y-2">
                  {stockLoading && <div className="text-xs text-gray-500">Loading stock...</div>}
                  {stockError && <div className="text-xs text-red-600">{stockError}</div>}
                  {!stockLoading &&
                    !stockError &&
                    warehouseStock.length > 0 && (() => {
                      // Get all unique UOMs across all warehouses for column alignment
                      const allUoms = new Set<string>()
                      warehouseStock.forEach((warehouse) => {
                        warehouse.quantities.forEach((qtyItem) => {
                          if (qtyItem.uom) {
                            allUoms.add(qtyItem.uom)
                          }
                        })
                      })
                      const uniqueUoms = Array.from(allUoms).sort()
                      
                      // Get selected item's UOM
                      const selectedItemUom = selectedItem?.uom || ''
                      
                      return warehouseStock.map((warehouse, index) => {
                        // Get current warehouse from profile
                        const currentWarehouse = profile?.warehouse || ''
                        const isCurrentWarehouse = warehouse.name === currentWarehouse
                        
                        return (
                      <div
                        key={index}
                            className={`p-2 rounded-lg text-xs ${
                              isCurrentWarehouse 
                                ? 'bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-400' 
                                : 'bg-gradient-to-r from-gray-50 to-slate-50'
                            }`}
                      >
                        <div className="flex justify-between items-center">
                              <div className={`font-semibold ${isCurrentWarehouse ? 'text-gray-700' : 'text-primary'}`}>
                                {warehouse.name}
                          </div>
                              <div className="flex items-center gap-4 justify-end">
                                {uniqueUoms.map((uom) => {
                                  // Find quantity for this UOM in current warehouse
                                  const qtyItem = warehouse.quantities.find(
                                    (item) => (item.uom || '').trim().toLowerCase() === uom.trim().toLowerCase()
                                  )
                                  
                                  if (!qtyItem) {
                                    // If this UOM doesn't exist for this warehouse, show empty space for alignment
                                    return (
                                      <div key={uom} className="w-16 text-right">
                                        <span className="text-transparent">-</span>
                        </div>
                                    )
                                  }
                                  
                                  // Normalize UOM strings for comparison
                                  const qtyItemUom = (qtyItem.uom || '').trim().toLowerCase()
                                  const selectedUomNormalized = (selectedItemUom || '').trim().toLowerCase()
                                  const isSelectedUom = qtyItemUom === selectedUomNormalized
                                  
                                  // Highlight based on UOM match only
                                  const isHighlighted = isSelectedUom && selectedItemUom !== ''
                                  
                                  return (
                                    <div 
                                      key={uom} 
                                      className="text-right"
                                      style={{ minWidth: '60px' }}
                                    >
                                      <div className={`font-semibold ${isHighlighted ? 'text-blue-700' : 'text-gray-700'}`}>
                                        {qtyItem.qty}
                      </div>
                                      <div className={`text-[10px] ${isHighlighted ? 'font-bold text-blue-700' : 'text-gray-700 font-normal'}`}>
                                        {qtyItem.uom}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    })()}
                  {!stockLoading && !stockError && warehouseStock.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No stock available</div>
                  )}
                </div>
              </div>

              {/* Product History Section */}
              <div className="bg-white/90 mt-2">
                <div className={`flex border-b border-gray-200/60 ${shouldScrollTabs ? 'overflow-x-auto scrollbar-hide scroll-smooth' : ''}`}>
                  <div className={`flex ${shouldScrollTabs ? 'min-w-max' : 'w-full'}`}>
                    <button
                      className={`px-4 py-3 font-bold text-sm border-b-2 ${shouldScrollTabs ? 'whitespace-nowrap' : 'flex-1'} ${
                        productSubTab === 'sales-history'
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'text-gray-500 hover:text-black hover:bg-white/40'
                      }`}
                      onClick={() => {
                        console.log('🔄 Switching to Sales History tab')
                        setProductSubTab('sales-history')
                        if (selectedItemId) {
                          console.log('🔄 Triggering sales history fetch from tab click')
                          fetchSalesHistory(selectedItemId)
                        }
                      }}
                    >
                      Sales History
                    </button>
                    <button
                      className={`px-4 py-3 font-bold text-sm border-b-2 ${shouldScrollTabs ? 'whitespace-nowrap' : 'flex-1'} ${
                        productSubTab === 'customer-history'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'text-gray-500 hover:text-black hover:bg-white/40'
                      }`}
                      onClick={() => {
                        console.log('🔄 Switching to Customer History tab')
                        setProductSubTab('customer-history')
                        if (selectedItemId) {
                          console.log('🔄 Triggering customer history fetch from tab click')
                          fetchCustomerHistory(selectedItemId)
                        }
                      }}
                    >
                      Customer History
                    </button>
                    {showPurchaseHistory && (
                      <button
                        className={`px-4 py-3 font-bold text-sm border-b-2 ${shouldScrollTabs ? 'whitespace-nowrap' : 'flex-1'} ${
                          productSubTab === 'purchase-history'
                            ? 'border-purple-500 bg-purple-50 text-purple-700'
                            : 'text-gray-500 hover:text-black hover:bg-white/40'
                        }`}
                        onClick={() => {
                          console.log('🔄 Switching to Purchase History tab')
                          setProductSubTab('purchase-history')
                          if (selectedItemId) {
                            console.log('🔄 Triggering purchase history fetch from tab click')
                            fetchPurchaseHistory(selectedItemId)
                          }
                        }}
                      >
                        Purchase History
                      </button>
                    )}
                  </div>
                </div>

                {/* Sales History Tab */}
                {productSubTab === 'sales-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Sales history for {selectedItem?.item_name || selectedItemId || 'selected product'}
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search sales history..."
                        value={salesHistorySearch}
                        onChange={(e) => setSalesHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Sales History Content */}
                    <div ref={salesHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {salesHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading sales history...</div>
                        </div>
                      ) : salesHistory.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No sales history found</div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {salesHistory
                            .filter((item: any) => {
                              if (!salesHistorySearch) return true
                              const searchLower = salesHistorySearch.toLowerCase()
                              return (
                                item.sales_order_no?.toLowerCase().includes(searchLower) ||
                                item.invoice_no?.toLowerCase().includes(searchLower)
                              )
                            })
                            .map((item: any, index: number) => {
                              const formatDate = (dateString: string) => {
                                if (!dateString) return '—'
                                const date = new Date(dateString)
                                const day = String(date.getDate()).padStart(2, '0')
                                const month = String(date.getMonth() + 1).padStart(2, '0')
                                const year = date.getFullYear()
                                return `${day}/${month}/${year}`
                              }
                              // const totalAmount = (Number(item.qty || 0) * Number(item.unit_price || 0)).toFixed(2) // Unused
                              const unitPrice = Number(item.unit_price || 0).toFixed(2)
                              // Extract order ID from item
                              const orderId = item.sales_order_id || item.sales_order_no || item.invoice_no || item.name
                              
                              return (
                                <div
                                  key={index}
                                  className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:shadow-sm transition"
                                  onClick={() => {
                                    if (orderId) {
                                      handleOpenOrder(String(orderId), false)
                                    }
                                  }}
                                >
                                  {/* Order No and Date Row */}
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="font-semibold text-black text-sm">
                                      {item.sales_order_no || item.invoice_no || '—'}
                                    </div>
                                    <div className="text-gray-600 text-xs">
                                      {item.creation_datetime
                                        ? formatDate(item.creation_datetime)
                                        : '—'}
                                    </div>
                                  </div>

                                  {/* Customer Name and Amount Row */}
                                  <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-700 font-medium text-xs">
                                      {item.customer_name || item.customer || '—'}
                                    </span>
                                    <span className="text-gray-600 font-medium text-xs">
                                      Unit: <span className="font-bold text-green-600">{unitPrice} {currencySymbol}</span>
                                    </span>
                                  </div>

                                  {/* Total Qty Row */}
                                  <div className="mb-2">
                                    <span className="text-gray-600 font-medium text-xs">
                                      Qty: {item.quantity || item.qty || 0}
                                    </span>
                                  </div>

                                  {/* Status Row */}
                                  <div className="flex items-center gap-2">
                                    {item.status && (
                                      <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                                        {item.status}
                                      </span>
                                    )}
                                    {!item.status && (
                                      <span className="text-gray-400 text-xs">—</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {/* Pagination Controls */}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${
                          salesHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                        }`}
                        disabled={salesHistoryPage <= 1}
                        onClick={() => {
                          const prev = Math.max(1, salesHistoryPage - 1)
                          setSalesHistoryPage(prev)
                          fetchSalesHistory(selectedItemId as string, prev, salesHistorySearch)
                          salesHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {salesHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${
                          salesHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'
                        }`}
                        disabled={!salesHasMoreRef.current}
                        onClick={() => {
                          const next = salesHistoryPage + 1
                          setSalesHistoryPage(next)
                          fetchSalesHistory(selectedItemId as string, next, salesHistorySearch)
                          salesHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Customer History Tab */}
                {productSubTab === 'customer-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      {selectedCustomer
                        ? `Customer history for ${selectedCustomer.name}`
                        : 'Select a customer to view customer history'}
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search customer history..."
                        value={customerHistorySearch}
                        onChange={(e) => setCustomerHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Customer History Content */}
                    <div ref={customerHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {!selectedCustomer ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">
                            Select a customer to view history
                          </div>
                        </div>
                      ) : customerHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading customer history...</div>
                        </div>
                      ) : filteredCustomerHistory.length > 0 ? (
                        <div className="space-y-2">
                          {filteredCustomerHistory.map((item, index) => {
                            const formatDate = (dateString: string) => {
                              if (!dateString) return '—'
                              const date = new Date(dateString)
                              const day = String(date.getDate()).padStart(2, '0')
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const year = date.getFullYear()
                              return `${day}/${month}/${year}`
                            }
                            const unitPrice = Number(item.unit_price || 0).toFixed(2)
                            // Extract order ID from item
                            const orderId = item.sales_order_id || item.sales_order_no || item.invoice_no || item.name
                            
                            return (
                              <div
                                key={index}
                                className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:shadow-sm transition"
                                onClick={() => {
                                  if (orderId) {
                                    handleOpenOrder(String(orderId), false)
                                  }
                                }}
                              >
                                {/* Order No and Date Row */}
                                <div className="flex justify-between items-center mb-2">
                                  <div className="font-semibold text-black text-sm">
                                    {item.sales_order_no || item.invoice_no || '—'}
                                  </div>
                                  <div className="text-gray-600 text-xs">
                                    {item.creation_datetime
                                      ? formatDate(item.creation_datetime)
                                      : '—'}
                                  </div>
                                </div>

                                {/* Customer Name and Amount Row */}
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-700 font-medium text-xs">
                                    {item.customer_name || item.customer || selectedCustomer?.name || '—'}
                                  </span>
                                  <span className="text-gray-600 font-medium text-xs">
                                    Unit: <span className="font-bold text-green-600">{unitPrice} {currencySymbol}</span>
                                  </span>
                                </div>

                                {/* Total Qty Row */}
                                <div className="mb-2">
                                  <span className="text-gray-600 font-medium text-xs">
                                    Qty: {item.quantity || item.qty || 0}
                                  </span>
                                </div>

                                {/* Status Row */}
                                <div className="flex items-center gap-2">
                                  {item.status && (
                                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-gray-100 text-gray-700">
                                      {item.status}
                                    </span>
                                  )}
                                  {!item.status && (
                                    <span className="text-gray-400 text-xs">—</span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No customer history found</div>
                        </div>
                      )}
                    </div>
                    {/* Pager */}
                    <div className="flex items-center justify-between mt-3">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${customerHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={customerHistoryPage <= 1}
                        onClick={() => {
                          if (customerHistoryPage <= 1) return
                          const prev = Math.max(1, customerHistoryPage - 1)
                          setCustomerHistoryPage(prev)
                          fetchCustomerHistory(selectedItemId as string, prev, customerHistorySearch)
                          customerHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {customerHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${customerHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={!customerHasMoreRef.current}
                        onClick={() => {
                          if (!customerHasMoreRef.current) return
                          const next = customerHistoryPage + 1
                          setCustomerHistoryPage(next)
                          fetchCustomerHistory(selectedItemId as string, next, customerHistorySearch)
                          customerHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* Purchase History Tab */}
                {productSubTab === 'purchase-history' && (
                  <div className="p-4">
                    <div className="text-xs text-gray-500 mb-2">
                      Purchase history for selected product
                    </div>

                    {/* Search Bar */}
                    <div className="relative mb-4">
                      <input
                        type="text"
                        placeholder="Search purchase history..."
                        value={purchaseHistorySearch}
                        onChange={(e) => setPurchaseHistorySearch(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg
                          className="w-4 h-4 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Purchase History Content */}
                    <div ref={purchaseHistoryScrollRef} className="max-h-64 overflow-y-auto scrollbar-hide">
                      {purchaseHistoryLoading ? (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">Loading purchase history...</div>
                        </div>
                      ) : filteredPurchaseHistory.length > 0 ? (
                        <div className="space-y-2">
                          {filteredPurchaseHistory.map((item, index) => {
                            const formatDate = (dateString: string) => {
                              if (!dateString) return '—'
                              const date = new Date(dateString)
                              const day = String(date.getDate()).padStart(2, '0')
                              const month = String(date.getMonth() + 1).padStart(2, '0')
                              const year = date.getFullYear()
                              return `${day}/${month}/${year}`
                            }
                            const totalAmount = item.total_amount ? Number(item.total_amount).toFixed(2) : (Number(item.qty || 0) * Number(item.unit_price || 0)).toFixed(2)
                            const unitPrice = Number(item.unit_price || 0).toFixed(2)
                            return (
                              <div
                                key={index}
                                className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200"
                              >
                                {/* Invoice No and Date Row */}
                                <div className="flex justify-between items-center mb-2">
                                  <div className="font-semibold text-black text-sm">
                                    {item.invoice_no || item.purchase_order_no || '—'}
                                  </div>
                                  <div className="text-gray-600 text-xs">
                                    {item.creation_datetime
                                      ? formatDate(item.creation_datetime)
                                      : '—'}
                                  </div>
                                </div>

                                {/* Amount Row */}
                                <div className="flex justify-between items-center mb-2">
                                  <span className="text-gray-600 font-medium text-xs">
                                    Qty: {item.qty || 0}
                                  </span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-gray-600 font-medium text-xs">
                                      Unit: <span className="font-bold text-green-600">{unitPrice} {currencySymbol}</span>
                                    </span>
                                    <span className="text-gray-600 font-medium text-xs mt-0.5">
                                      Total: <span className="font-bold text-green-600">{totalAmount} {currencySymbol}</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <div className="text-sm text-gray-500">No purchase history found</div>
                        </div>
                      )}
                    </div>
                    {/* Pager */}
                    <div className="flex items-center justify-between mt-3">
                      <button
                        className={`px-3 py-1 text-sm rounded border ${purchaseHistoryPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={purchaseHistoryPage <= 1}
                        onClick={() => {
                          if (purchaseHistoryPage <= 1) return
                          const prev = Math.max(1, purchaseHistoryPage - 1)
                          setPurchaseHistoryPage(prev)
                          fetchPurchaseHistory(selectedItemId as string, prev, purchaseHistorySearch)
                          purchaseHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Prev
                      </button>
                      <div className="text-sm text-gray-600">Page {purchaseHistoryPage}</div>
                      <button
                        className={`px-3 py-1 text-sm rounded border ${purchaseHasMoreRef.current ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                        disabled={!purchaseHasMoreRef.current}
                        onClick={() => {
                          if (!purchaseHasMoreRef.current) return
                          const next = purchaseHistoryPage + 1
                          setPurchaseHistoryPage(next)
                          fetchPurchaseHistory(selectedItemId as string, next, purchaseHistorySearch)
                          purchaseHistoryScrollRef.current?.scrollTo({ top: 0 })
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'customer' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4 border-b border-gray-200/60 bg-white/90">
            {customerDetailsLoading && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Loading customer details...</div>
              </div>
            )}
            {customerDetailsError && (
              <div className="text-center py-4">
                <div className="text-sm text-red-600">{customerDetailsError}</div>
              </div>
            )}
            {!customerDetailsLoading && !customerDetailsError && customerDetails && 
             typeof customerDetails === 'object' && 
             (customerDetails.customer_name || customerDetails.name) && 
             !customerDetails.status && 
             !customerDetails.message && (
              <>
                <div className="flex items-center gap-4 mb-6 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-r from-primary to-slate-700 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" aria-hidden="true" focusable="false" data-prefix="fas" data-icon="user" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor">
                      <path d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z"></path>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-bold text-lg">
                        {String(customerDetails.customer_name || customerDetails.name || '')}
                      </h3>
                      <button
                        type="button"
                        onClick={() => triggerTabRefresh('customer')}
                        className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                        title="Refresh customer data"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </button>
                    </div>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">VAT: {String(customerDetails.tax_id || 'Not Applicable')}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">Type: {String(customerDetails.customer_type || '—')}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">Mobile: {String(customerDetails.mobile_no || '—')}</p>
                    <p style={{ fontSize: '12px' }} className="text-sm text-gray-600">
                      ADDRESS:{' '}
                      {customerDetails.primary_address && typeof customerDetails.primary_address === 'string'
                        ? customerDetails.primary_address
                            .replace(/<br\s*\/?>/gi, ', ')
                            .replace(/<[^>]+>/g, '')
                            .trim()
                        : 'Address not available'}
                    </p>
                  </div>
                  </div>
                  <div>
                    <button
                      className="px-3 py-1.5 text-sm border rounded hover:bg-gray-50"
                      onClick={async () => {
                        // Fetch fresh customer details to ensure we have latest data
                        const customerId = customerDetails.name || selectedCustomer?.name || selectedCustomer?.customer_id
                        if (!customerId) {
                          toast.error('Customer ID not found')
                          return
                        }

                        try {
                          setEditOpen(true) // Open dialog first to show loading state
                          setEditFormLoading(true)
                          
                          // Fetch fresh customer details from API
                          console.log('📞 API Call: get_customer_details (Edit)', {
                            url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
                            params: { customer_id: customerId }
                          })
                          const detailsRes = await (window as any).electronAPI?.proxy?.request({
                            url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
                            params: { customer_id: customerId }
                          })

                          console.log('📥 API Response: get_customer_details (Edit)', {
                            fullResponse: detailsRes,
                            data: detailsRes?.data,
                            customerData: detailsRes?.data?.data || detailsRes?.data
                          })

                          const customerData = detailsRes?.data?.data || detailsRes?.data
                          if (!customerData) {
                            toast.error('Failed to load customer details')
                            setEditOpen(false)
                            return
                          }

                          // Helper function to parse address from primary_address HTML
                          // Format: "987 Vadakkan House<br>\nAziziya<br>Riyadh<br>\n12345<br>Saudi Arabia<br>\n<br>\n"
                          const parseAddressFromHTML = (htmlAddress: string) => {
                            if (!htmlAddress || typeof htmlAddress !== 'string') {
                              return { line1: '', line2: '', city: '', pincode: '', country: '', building: '' }
                            }
                            
                            // Remove HTML tags and split by <br> tags (including newlines)
                            const cleanAddress = htmlAddress
                              .replace(/<br\s*\/?>/gi, '|')
                              .replace(/<[^>]+>/g, '')
                              .replace(/\n/g, '')
                              .trim()
                            
                            const parts = cleanAddress
                              .split('|')
                              .map(p => p.trim())
                              .filter(p => p && p.length > 0)
                            
                            // Typical structure: [address_line1, address_line2, city, pincode, country]
                            // Building number might be in line2 or separate
                            let building = ''
                            const line2 = parts[1] || ''
                            
                            // Try to extract building number from line2 if it contains "building" or numbers
                            if (line2.toLowerCase().includes('building')) {
                              building = line2
                            } else if (line2.match(/^\d+/)) {
                              // If line2 starts with numbers, it might be building number
                              building = line2
                            }
                            
                            return {
                              line1: parts[0] || '',
                              line2: building ? '' : (parts[1] || ''), // Don't duplicate if building was extracted
                              city: parts[2] || '',
                              pincode: parts[3] || '',
                              country: parts[4] || '',
                              building: building
                            }
                          }

                          // Get address details from primary_address_details object
                          const primaryAddress = customerData.primary_address_details || {}
                          
                          // Parse address from HTML as fallback if primary_address_details is not available
                          const parsedAddress = customerData.primary_address 
                            ? parseAddressFromHTML(customerData.primary_address)
                            : { line1: '', line2: '', city: '', pincode: '', country: '', building: '' }

                          // Populate form with mapped API response fields
                          setEditForm({
                            customer_id: customerData.name || customerId,
                            customer_name: customerData.customer_name || '',
                            customer_name_arabic: customerData.zatca_customer_name_in_arabic || customerData.customer_name_arabic || '',
                            email: customerData.email_id || '',
                            mobile: customerData.mobile_no || '',
                            customer_type: customerData.customer_type || 'Individual',
                            tax_id: customerData.tax_id || '',
                            // Use custom_selected_buyer_id_type and custom_selected_buyer_id_value from API
                            customer_id_type_for_zatca: customerData.custom_selected_buyer_id_type || customerData.custom_buyer_id_type || customerData.customer_id_type_for_zatca || '',
                            customer_id_number_for_zatca: customerData.custom_selected_buyer_id_value || customerData.custom_buyer_id || customerData.customer_id_number_for_zatca || '',
                            // Use primary_address_details object for address fields, with fallback to parsed HTML or top-level fields
                            address_line1: primaryAddress.address_line1 || customerData.address_line1 || parsedAddress.line1 || '',
                            address_line2: primaryAddress.address_line2 || customerData.address_line2 || parsedAddress.line2 || '',
                            building_number: primaryAddress.custom_building_number || customerData.building_number || parsedAddress.building || '',
                            city: primaryAddress.city || customerData.city || parsedAddress.city || '',
                            pincode: primaryAddress.pincode || customerData.pincode || parsedAddress.pincode || '',
                            country: primaryAddress.country || customerData.country || parsedAddress.country || 'Saudi Arabia'
                          })
                          setEditFormLoading(false)
                        } catch (error) {
                          console.error('❌ Error loading customer details for edit:', error)
                          toast.error('Failed to load customer details')
                          setEditFormLoading(false)
                          setEditOpen(false)
                        }
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-xs text-gray-600">Total Invoiced</div>
                    <div className="font-bold text-blue-600">
                      {(() => {
                        const inv = Number(customerInsights?.total_invoice_amount ?? 0)
                        const ret = Number(customerInsights?.total_return_amount ?? 0)
                        const net = inv - ret
                        if (isNaN(net)) return '0.00'
                        const formattedValue = Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return net < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl">
                    <div className="text-xs text-gray-600">Amount Due</div>
                    <div className="font-bold text-red-600">
                      {(() => {
                        const value = Number(customerInsights?.amount_due ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                    <div className="text-xs text-gray-600">
                      Last Payment{' '}
                      {customerInsights?.last_payment_datetime
                        ? `| ${new Date(customerInsights.last_payment_datetime).toLocaleDateString(
                            'en-US',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }
                          )}`
                        : ''}
                    </div>
                    <div className="font-bold text-green-600">
                      {(customerInsights?.last_payment_amount?.toLocaleString() || '0.00')}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-blue-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      {(() => {
                        const value = Number(customerInsights?.total_credit_limit ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl">
                    <div className="text-xs text-gray-600">Available Credit Limit</div>
                    <div className="font-bold text-orange-600">
                      {(() => {
                        const value = Number(customerInsights?.available_credit_limit ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
                    <div className="text-xs text-gray-600">Deposit Insights</div>
                    <div className="font-bold text-emerald-600">
                      {(() => {
                        const value = Number(customerInsights?.advance_balance ?? 0)
                        if (isNaN(value)) return '0.00'
                        const formattedValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        return value < 0 ? `-${formattedValue}` : formattedValue
                      })()}{' '}{currencySymbol}
                    </div>
                  </div>
                  <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    <div className="text-[10px] text-gray-600">Returns vs Invoices</div>
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[11px] font-semibold text-purple-700">
                        Returns:{' '}
                        {(() => {
                          const value = Number(customerInsights?.total_return_amount ?? 0)
                          if (isNaN(value)) return '0'
                          const formattedValue = Math.abs(value).toLocaleString('en-US')
                          return value < 0 ? `-${formattedValue}` : formattedValue
                        })()}{' '}{currencySymbol}
                      </span>
                      <span className="text-[11px] font-semibold text-blue-600">
                        Invoices:{' '}
                        {(() => {
                          const value = Number(customerInsights?.total_invoice_amount ?? 0)
                          if (isNaN(value)) return '0'
                          const formattedValue = Math.abs(value).toLocaleString('en-US')
                          return value < 0 ? `-${formattedValue}` : formattedValue
                        })()}{' '}{currencySymbol}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {!customerDetailsLoading && !customerDetailsError && !customerDetails && !selectedCustomer && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Select a customer to view details</div>
              </div>
            )}
            {!customerDetailsLoading && !customerDetailsError && !customerDetails && selectedCustomer && (
              <div className="text-center py-4">
                <div className="text-sm text-gray-500">Loading customer details...</div>
              </div>
            )}
          </div>

          {/* Edit Customer Dialog */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Customer</DialogTitle>
              </DialogHeader>
              {editFormLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-sm text-gray-600">Loading customer details...</span>
                </div>
              ) : (
              <>
              <div className="space-y-3 p-2">
                {/* Customer ID - Keep as is */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Customer ID</label>
                  <Input disabled value={editForm.customer_id} />
                </div>

                {/* Row 1: Customer Name and Name in Arabic */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Customer Name *</label>
                    <Input
                      value={editForm.customer_name}
                      onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="Enter customer name"
                    />
                </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Name in Arabic</label>
                    <Input
                      value={editForm.customer_name_arabic}
                      onChange={(e) => setEditForm({ ...editForm, customer_name_arabic: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="اكتب الاسم بالعربية"
                    />
                </div>
                </div>

                {/* Row 1b: Customer Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Customer Type *</label>
                    <Select
                      value={editForm.customer_type}
                      onValueChange={(value) => setEditForm({ ...editForm, customer_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer type" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-white border border-gray-200 shadow-xl">
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Company">Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Row 2: Email and Mobile */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="email@example.com"
                    />
                </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Mobile{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.mobile}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="+966509876543"
                    />
                </div>
                </div>

                {/* Separator */}
                <div className="border-t border-gray-300 my-2"></div>

                {/* Row 3: Tax ID and ZATCA fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Tax ID{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.tax_id}
                      onChange={(e) => setEditForm({ ...editForm, tax_id: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="310123456700003"
                    />
                </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Customer ID Type for ZATCA{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Select
                      value={editForm.customer_id_type_for_zatca}
                      onValueChange={(value) => setEditForm({ ...editForm, customer_id_type_for_zatca: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select ID type" />
                      </SelectTrigger>
                      <SelectContent className="z-[9999] bg-white border border-gray-200 shadow-xl max-h-[200px]">
                        <SelectItem value="TIN">TIN</SelectItem>
                        <SelectItem value="CRN">CRN</SelectItem>
                        <SelectItem value="MOM">MOM</SelectItem>
                        <SelectItem value="MLS">MLS</SelectItem>
                        <SelectItem value="700">700</SelectItem>
                        <SelectItem value="SAG">SAG</SelectItem>
                        <SelectItem value="NAT">NAT</SelectItem>
                        <SelectItem value="GCC">GCC</SelectItem>
                        <SelectItem value="IQA">IQA</SelectItem>
                        <SelectItem value="PAS">PAS</SelectItem>
                        <SelectItem value="OTH">OTH</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                </div>

                {/* Row 4: ZATCA ID Number and Country */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Customer ID Number for ZATCA{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.customer_id_number_for_zatca}
                      onChange={(e) => setEditForm({ ...editForm, customer_id_number_for_zatca: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="1010123456"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Country</label>
                    <Input
                      value={editForm.country}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="Saudi Arabia"
                    />
                  </div>
                </div>

                {/* Row 5: Address Line 1 and 2 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Address Line 1{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.address_line1}
                      onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="789 King Abdullah Road"
                    />
                </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Address Line 2</label>
                    <Input
                      value={editForm.address_line2}
                      onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="Building 8221"
                    />
                </div>
                </div>

                {/* Row 6: City/Town, Building No., Pincode */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">City/Town{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="Riyadh"
                    />
              </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Building No.{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.building_number}
                      onChange={(e) => setEditForm({ ...editForm, building_number: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                        if (e.key === ' ') {
                          e.stopPropagation()
                        }
                      }}
                      placeholder="Building number"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Pincode{editForm.customer_type === 'Company' ? ' *' : ''}</label>
                    <Input
                      value={editForm.pincode}
                      onChange={(e) => setEditForm({ ...editForm, pincode: e.target.value })}
                      onKeyDown={(e) => {
                        const target = e.target as HTMLElement
                        // Allow arrow keys for text editing in input/textarea fields
                        const isInputField = target.tagName === 'INPUT' || 
                                            target.tagName === 'TEXTAREA' ||
                                            target.closest('input') ||
                                            target.closest('textarea')
                        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && isInputField) {
                          e.stopPropagation()
                          // Don't prevent default - let browser handle cursor movement
                          return
                        }
                      }}
                      placeholder="11564"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter className="gap-2 mt-4">
                <Button variant="outline" onClick={()=>setEditOpen(false)}>Cancel</Button>
                <Button disabled={editSubmitting} onClick={async()=>{
                  try{
                    setEditSubmitting(true)
                    console.log('📝 Editing customer - request body:', editForm)
                    // validation
                    if(!editForm.customer_name){ toast.error('Customer name is required'); setEditSubmitting(false); return }
                    if(editForm.customer_type==='Company'){
                      if(!editForm.mobile){ toast.error('Mobile is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.tax_id){ toast.error('Tax ID is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.customer_id_type_for_zatca || !editForm.customer_id_number_for_zatca){
                        toast.error('ZATCA ID Type and Number are required for Company'); setEditSubmitting(false); return
                      }
                      if(!editForm.address_line1){ toast.error('Address Line 1 is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.city){ toast.error('City/Town is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.building_number){ toast.error('Building No. is required for Company'); setEditSubmitting(false); return }
                      if(!editForm.pincode){ toast.error('Pincode is required for Company'); setEditSubmitting(false); return }
                    }
                    
                    // Prepare API payload with all required fields, ensuring empty values are sent as empty strings
                    const apiPayload = {
                      customer_id: editForm.customer_id || '',
                      customer_name: editForm.customer_name || '',
                      customer_name_arabic: editForm.customer_name_arabic || '',
                      email: editForm.email || '',
                      mobile: editForm.mobile || '',
                      customer_type: editForm.customer_type || 'Individual',
                      tax_id: editForm.tax_id || '',
                      customer_id_type_for_zatca: editForm.customer_id_type_for_zatca || '',
                      customer_id_number_for_zatca: editForm.customer_id_number_for_zatca || '',
                      address_line1: editForm.address_line1 || '',
                      address_line2: editForm.address_line2 || '',
                      building_number: editForm.building_number || '',
                      city: editForm.city || '',
                      pincode: editForm.pincode || '',
                      country: editForm.country || ''
                    }
                    
                    console.log('📝 Editing customer - API call:', {
                      method: 'POST',
                      url: '/api/method/centro_pos_apis.api.customer.edit_customer',
                      body: apiPayload
                    })
                    
                    const res = await (window as any).electronAPI?.proxy?.request({
                      method:'POST',
                      url:'/api/method/centro_pos_apis.api.customer.edit_customer',
                      data: apiPayload
                    })
                    
                    console.log('✅ Edit customer response:', {
                      status: res?.status,
                      success: res?.success,
                      data: res?.data,
                      fullResponse: res
                    })
                    
                    // Extract message safely - ensure it's always a string
                    let serverMsg: string = 'Customer updated successfully'
                    if (res?.data?.data) {
                      if (typeof res.data.data === 'object' && res.data.data !== null) {
                        // If data.data is an object, extract message from it
                        if (typeof res.data.data.message === 'string') {
                          serverMsg = res.data.data.message
                        }
                      } else if (typeof res.data.data === 'string') {
                        serverMsg = res.data.data
                      }
                    } else if (res?.data?.message) {
                      if (typeof res.data.message === 'string') {
                        serverMsg = res.data.message
                      }
                    }
                    
                    const serverError = res?.data?._server_messages
                    if (res?.success === false || res?.status >= 400 || serverError) {
                      let prettyErr = 'Update failed'
                      console.log('❌ Edit customer server error raw:', serverError)
                      try {
                        if (typeof serverError === 'string') {
                          // Try direct JSON parse
                          try {
                            const arr = JSON.parse(serverError)
                            if (Array.isArray(arr) && arr.length) {
                              const obj = arr[0]
                              if (typeof obj === 'object') {
                                if (obj.message) prettyErr = obj.message
                                else prettyErr = JSON.stringify(obj, null, 2)
                              } else if (typeof obj === 'string') {
                                prettyErr = obj
                              }
                            }
                          } catch (e1) {
                            // Try with unescaped quotes cleanup
                            const cleaned = serverError
                              .replace(/\\n/g, '\n')
                              .replace(/\\r/g, '\r')
                              .replace(/\\t/g, '\t')
                              .replace(/\\\\/g, '\\')
                              .replace(/\\\"/g, '"')
                            try {
                              const arr2 = JSON.parse(cleaned)
                              if (Array.isArray(arr2) && arr2.length) {
                                const obj2 = arr2[0]
                                if (typeof obj2 === 'object') {
                                  if (obj2.message) prettyErr = obj2.message
                                  else prettyErr = JSON.stringify(obj2, null, 2)
                                } else if (typeof obj2 === 'string') {
                                  prettyErr = obj2
                                }
                              }
                            } catch (e2) {
                              // Last resort: extract between \"message\": \" ... \"
                              const m = serverError.match(/message\\\"\s*:\s*\\\"([^\"]+)/i)
                              if (m && m[1]) prettyErr = m[1]
                            }
                          }
                        }
                      } catch (_) {}
                      // Prefer showing only the human-friendly message
                      let uiMsg = prettyErr
                      try {
                        if (prettyErr.startsWith('[')) {
                          const arr = JSON.parse(prettyErr)
                          const obj = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0]
                          if (obj?.message) uiMsg = obj.message
                        } else if (prettyErr.startsWith('{')) {
                          const obj = JSON.parse(prettyErr)
                          if (obj?.message) uiMsg = obj.message
                        }
                      } catch (_) {}
                      toast.error(typeof uiMsg === 'string' ? uiMsg : 'Failed to update customer')
                      setEditSubmitting(false)
                      return
                    }
                    
                    // Ensure msg is always a string
                    const msg = typeof serverMsg === 'string' ? serverMsg : 'Customer updated successfully'
                    
                    // refresh details
                    if (selectedCustomer?.name || selectedCustomer?.customer_id || customerDetails?.name){
                      // trigger reload using existing loadCustomerDetails flow
                      try{ await (async()=>{ 
                        // let cancelled=false; // Unused 
                        setCustomerDetailsLoading(true); setCustomerDetailsError(null); 
                        const listRes = await (window as any).electronAPI?.proxy?.request({url: '/api/method/centro_pos_apis.api.customer.customer_list', params:{search_term:'', limit_start:1, limit_page_length:50}})
                        const list = listRes?.data?.data || []
                        const match = list.find((c:any)=> c.customer_name === (selectedCustomer?.name || customerDetails?.customer_name))
                        const customerId = match?.name || customerDetails?.name
                        if (customerId){
                          console.log('📞 API Call: get_customer_details (Refresh)', {
                            url: '/api/method/centro_pos_apis.api.customer.get_customer_details',
                            params: { customer_id: customerId }
                          })
                          const detailsRes = await (window as any).electronAPI?.proxy?.request({url:'/api/method/centro_pos_apis.api.customer.get_customer_details', params:{customer_id: customerId}})
                          console.log('📥 API Response: get_customer_details (Refresh)', {
                            fullResponse: detailsRes,
                            data: detailsRes?.data,
                            customerData: detailsRes?.data?.data
                          })
                          
                          // Safely extract customer data - ensure it's a proper customer object, not a response wrapper
                          let customerData: any = null
                          if (detailsRes?.data?.data) {
                            // Check if data.data is a valid customer object (has customer_name or name property)
                            if (detailsRes.data.data && typeof detailsRes.data.data === 'object' && 
                                (detailsRes.data.data.customer_name || detailsRes.data.data.name)) {
                              customerData = detailsRes.data.data
                            }
                          } else if (detailsRes?.data && typeof detailsRes.data === 'object' && 
                                     (detailsRes.data.customer_name || detailsRes.data.name)) {
                            // Fallback: check if data itself is the customer object
                            customerData = detailsRes.data
                          }
                          
                          // Only set if we have valid customer data (not a response wrapper object)
                          if (customerData && !customerData.status && !customerData.message) {
                            setCustomerDetails(customerData)
                          } else {
                            console.warn('⚠️ Invalid customer data structure received:', customerData)
                          }
                        }
                        setCustomerDetailsLoading(false)
                      })() }catch(e){
                        console.error('❌ Error refreshing customer details after edit:', e)
                        setCustomerDetailsLoading(false)
                      }
                    }
                    toast.success(msg)
                    setEditOpen(false)
                  }catch(err){
                    console.error('❌ Edit customer error:', err)
                    const errorMsg = err instanceof Error ? err.message : 'Failed to update customer'
                    toast.error(typeof errorMsg === 'string' ? errorMsg : 'Failed to update customer')
                  }finally{
                    setEditSubmitting(false)
                  }
                }}>Save</Button>
              </DialogFooter>
              </>
              )}
            </DialogContent>
          </Dialog>

          {/* Customer insights: Recent Orders and Most Ordered */}
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  customerSubTab === 'recent'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('recent')}
              >
                Recent Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  customerSubTab === 'most'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setCustomerSubTab('most')}
              >
                Most Ordered
              </button>
            </div>

            {customerSubTab === 'recent' ? (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer
                    ? `Recent orders for ${selectedCustomer.name}`
                    : 'Select a customer to view recent orders'}
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search recent orders..."
                    value={recentOrdersSearch}
                    onChange={(e) => setRecentOrdersSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      Loading recent orders...
                    </div>
                  )}
                  {ordersError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersError}</div>
                  )}
                  {!ordersLoading &&
                    !ordersError &&
                    filteredRecentOrders.length > 0 &&
                    filteredRecentOrders.map((order, index) => {
                      // Extract order ID
                      const orderId = order.sales_order_id || order.sales_order_no || order.invoice_no || order.name
                      
                      return (
                      <div
                        key={index}
                        className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:shadow-sm transition"
                        onClick={() => {
                          if (orderId) {
                            handleOpenOrder(String(orderId), false)
                          }
                        }}
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex flex-col">
                          <div className="font-semibold text-primary text-sm">
                              {order.sales_order_no || order.sales_order_id || '—'}
                            </div>
                            {(order.invoice_no || order.sales_invoice_id) && (
                              <div className="text-gray-700 text-[10px] mt-0.5">
                                {order.invoice_no || order.sales_invoice_id}
                              </div>
                            )}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {new Date(order.creation_datetime).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-600 font-medium">Qty: {order.total_qty}</span>
                          <span className="font-bold text-green-600 text-sm">
                            {currencySymbol} {order.total_amount?.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span
                            className={`text-xs px-2 py-1 rounded-full font-medium ${
                              order.status === 'Overdue'
                                ? 'bg-red-100 text-red-700'
                                : order.status === 'Paid'
                                  ? 'bg-green-100 text-green-700'
                                  : order.status === 'Draft'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {new Date(order.creation_datetime).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      )
                    })}
                  {!ordersLoading &&
                    !ordersError &&
                    filteredRecentOrders.length === 0 &&
                    selectedCustomer && (
                      <div className="text-xs text-gray-500 text-center py-4">
                        No recent orders found
                      </div>
                    )}
                  {/* Pager for Recent Orders */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      className={`px-3 py-1 text-sm rounded border ${recentPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={recentPage <= 1}
                      onClick={() => setRecentPage(Math.max(1, recentPage - 1))}
                    >
                      Prev
                    </button>
                    <div className="text-sm text-gray-600">Page {recentPage}</div>
                    <button
                      className={`px-3 py-1 text-sm rounded border ${recentHasMore ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={!recentHasMore}
                      onClick={() => setRecentPage(recentPage + 1)}
                    >
                      Next
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Results per page</span>
                      <select
                        value={recentPageLength}
                        onChange={e => { setRecentPage(1); setRecentPageLength(Number(e.target.value)); }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        {pageSizeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt} / page</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-2">
                  {selectedCustomer
                    ? `Most ordered by ${selectedCustomer.name}`
                    : 'Select a customer to view most ordered products'}
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search most ordered..."
                    value={mostOrderedSearch}
                    onChange={(e) => setMostOrderedSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {mostLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">
                      Loading most ordered...
                    </div>
                  )}
                  {mostError && (
                    <div className="text-xs text-red-600 text-center py-4">{mostError}</div>
                  )}
                  {!mostLoading &&
                    !mostError &&
                    filteredMostOrdered.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <div className="font-semibold text-black">
                            {item.item_name} ({item.item_code})
                          </div>
                          <div className="text-gray-600">Qty: {item.total_qty}</div>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-gray-600">Avg Price: {item.avg_price}</span>
                          <span className="font-semibold text-purple-700">
                            Total: {item.total_price}
                          </span>
                        </div>
                      </div>
                    ))}
                  {!mostLoading &&
                    !mostError &&
                    filteredMostOrdered.length === 0 &&
                    selectedCustomer && (
                      <div className="text-xs text-gray-500 text-center py-4">No data</div>
                    )}
                  {/* Pager for Most Ordered */}
                  <div className="flex items-center justify-between mt-3">
                    <button
                      className={`px-3 py-1 text-sm rounded border ${mostPage > 1 ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={mostPage <= 1}
                      onClick={() => setMostPage(Math.max(1, mostPage - 1))}
                    >
                      Prev
                    </button>
                    <div className="text-sm text-gray-600">Page {mostPage}</div>
                    <button
                      className={`px-3 py-1 text-sm rounded border ${mostHasMore ? 'bg-white hover:bg-gray-50' : 'opacity-40 cursor-not-allowed'}`}
                      disabled={!mostHasMore}
                      onClick={() => setMostPage(mostPage + 1)}
                    >
                      Next
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Results per page</span>
                      <select
                        value={mostPageLength}
                        onChange={e => { setMostPage(1); setMostPageLength(Number(e.target.value)); }}
                        className="text-xs border rounded px-2 py-1"
                      >
                        {pageSizeOptions.map(opt => (
                          <option key={opt} value={opt}>{opt} / page</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'prints' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <PrintsTabContent />
        </div>
      )}

      {/* Multi Warehouse Popup */}
      {warehousePopupData && (
        <MultiWarehousePopup
          open={showWarehousePopup}
          onClose={() => {
            setShowWarehousePopup(false)
            setWarehousePopupData(null)
          }}
          onAssign={(allocations) => {
            if (!warehousePopupData) return

            // Calculate total allocated quantity from all warehouses
            const totalAllocated = allocations.reduce((sum, allocation) => {
              return sum + (Number(allocation.allocated) || 0)
            }, 0)

            // Get the current tab and update the item
            const currentTab = usePOSTabStore.getState().getCurrentTab()
            if (currentTab) {
              // Use itemIndex if available (for duplicate items), otherwise fall back to item_code
              if (warehousePopupData.itemIndex !== undefined && warehousePopupData.itemIndex >= 0) {
                // Update by index to ensure we update the correct duplicate item
                const { updateItemInTabByIndex } = usePOSTabStore.getState()
                updateItemInTabByIndex(currentTab.id, warehousePopupData.itemIndex, {
                  quantity: totalAllocated,
                  warehouseAllocations: allocations
                })
                console.log('📦 Updated warehouse allocation for item at index:', warehousePopupData.itemIndex)
              } else {
                // Fallback to item_code update (updates first match)
                updateItemInTab(currentTab.id, warehousePopupData.itemCode, {
                  quantity: totalAllocated,
                  warehouseAllocations: allocations
                })
                console.log('📦 Updated warehouse allocation for item by code:', warehousePopupData.itemCode)
              }
              toast.success('Warehouse allocation updated successfully')
            }

            setShowWarehousePopup(false)
            setWarehousePopupData(null)
          }}
          itemCode={warehousePopupData.itemCode}
          itemName={warehousePopupData.itemName}
          requiredQty={warehousePopupData.requiredQty}
          currentWarehouseQty={warehousePopupData.currentWarehouseQty}
          warehouses={warehousePopupData.warehouses}
          uom={warehousePopupData.uom}
          defaultWarehouse={warehousePopupData.defaultWarehouse}
        />
      )}

      {activeTab === 'orders' && (
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="bg-white/90 mt-2">
            <div className="flex border-b border-gray-200/60">
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  subTab === 'orders'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('orders')}
              >
                Orders
              </button>
              <button
                className={`flex-1 px-4 py-3 font-bold text-sm border-b-2 ${
                  subTab === 'returns'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'text-gray-500 hover:text-black hover:bg-white/40'
                }`}
                onClick={() => setSubTab('returns')}
              >
                Returns
              </button>
            </div>

            {subTab === 'orders' ? (
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-gray-500">
                    All Orders ({filteredOrders.length})
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerTabRefresh('orders')}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                    title="Refresh orders data"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search orders..."
                    value={ordersSearch}
                    onChange={(e) => setOrdersSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading orders...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading &&
                    !ordersTabError &&
                    filteredOrders.length > 0 &&
                    filteredOrders.map((order, index) => {
                      // Parse creation datetime
                      const creationRaw = order.creation
                      const creationDate = creationRaw ? new Date(String(creationRaw).replace(' ', 'T')) : null
                      const formatDate = (date: Date | null) => {
                        if (!date) return '—'
                        const day = String(date.getDate()).padStart(2, '0')
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const year = date.getFullYear()
                        return `${day}/${month}/${year}`
                      }
                      // const formatTime = (date: Date | null) => { // Unused
                      //   if (!date) return '—'
                      //   const hours = String(date.getHours()).padStart(2, '0')
                      //   const minutes = String(date.getMinutes()).padStart(2, '0')
                      //   return `${hours}:${minutes}`
                      // }

                      return (
                        <div
                          key={index}
                          className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:shadow-sm transition"
                          onClick={() => {
                            const orderId = order.sales_order_id || order.sales_invoice_id || order.name
                            if (orderId) {
                              handleOpenOrder(String(orderId), true) // Skip confirm for orders tab
                            }
                          }}
                        >
                          {/* Order No and Date Row */}
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex flex-col">
                            <div className="font-semibold text-black text-sm">
                              {order.sales_order_id || '—'}
                              </div>
                              {order.sales_invoice_id && (
                                <div className="text-gray-700 text-[10px] mt-0.5">
                                  {order.sales_invoice_id}
                                </div>
                              )}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {formatDate(creationDate)}
                            </div>
                          </div>

                          {/* Customer Name and Amount Row */}
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700 font-medium text-xs">
                              {order.customer_name || '—'}
                            </span>
                            <span className="font-bold text-green-600 text-sm">
                              {typeof order.grand_total === 'number' 
                                ? `${order.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`
                                : '—'}
                            </span>
                          </div>

                          {/* Total Qty Row */}
                          <div className="mb-2">
                            <span className="text-gray-600 font-medium text-xs">
                              Qty: {order.total_qty ?? '—'}
                            </span>
                          </div>

                          {/* Invoice Status and Reverse Status Row */}
                          <div className="flex items-center gap-2">
                            {order.invoice_status && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  order.invoice_status === 'Overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : order.invoice_status === 'Paid'
                                      ? 'bg-green-100 text-green-700'
                                      : order.invoice_status === 'Draft'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {order.invoice_status}
                              </span>
                            )}
                            {order.custom_reverse_status && order.custom_reverse_status !== 'No' && (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                                {order.custom_reverse_status}
                              </span>
                            )}
                            {!order.invoice_status && (!order.custom_reverse_status || order.custom_reverse_status === 'No') && (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  {!ordersTabLoading && !ordersTabError && filteredOrders.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No orders found</div>
                  )}
                  <div className="flex items-center justify-between pt-3">
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                      disabled={ordersPage <= 1}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-gray-600">Page {ordersPage}</div>
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setOrdersPage((p) => p + 1)}
                      disabled={filteredOrders.length < pageLength}
                    >
                      Next
                    </button>
                </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{ordersTotal} results found</span>
                    <select
                      value={pageLength}
                      onChange={e => setPageLength(Number(e.target.value))}
                      className="text-xs border rounded px-2 py-1"
                    >
                      {pageSizeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt} / page</option>
                      ))}
                    </select>
              </div>
                </div>
              </div>
            )
             : (
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs text-gray-500">Returns ({filteredReturns.length})</div>
                  <button
                    type="button"
                    onClick={() => triggerTabRefresh('orders')}
                    className="inline-flex items-center justify-center rounded-full p-2 text-gray-500 hover:text-black hover:bg-gray-100 transition-colors"
                    title="Refresh returns data"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="Search returns..."
                    value={returnsSearch}
                    onChange={(e) => setReturnsSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  {ordersTabLoading && (
                    <div className="text-xs text-gray-500 text-center py-4">Loading returns...</div>
                  )}
                  {ordersTabError && (
                    <div className="text-xs text-red-600 text-center py-4">{ordersTabError}</div>
                  )}
                  {!ordersTabLoading &&
                    !ordersTabError &&
                    filteredReturns.length > 0 &&
                    filteredReturns.map((order, index) => {
                      // Parse creation datetime
                      const creationRaw = order.creation
                      const creationDate = creationRaw ? new Date(String(creationRaw).replace(' ', 'T')) : null
                      const formatDate = (date: Date | null) => {
                        if (!date) return '—'
                        const day = String(date.getDate()).padStart(2, '0')
                        const month = String(date.getMonth() + 1).padStart(2, '0')
                        const year = date.getFullYear()
                        return `${day}/${month}/${year}`
                      }
                      // const formatTime = (date: Date | null) => { // Unused
                      //   if (!date) return '—'
                      //   const hours = String(date.getHours()).padStart(2, '0')
                      //   const minutes = String(date.getMinutes()).padStart(2, '0')
                      //   return `${hours}:${minutes}`
                      // }

                      return (
                        <div
                          key={index}
                          className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg text-xs border border-gray-200 cursor-pointer hover:shadow-sm transition"
                          onClick={() => {
                            const orderId = order.sales_order_id || order.sales_invoice_id || order.name
                            if (orderId) {
                              handleOpenOrder(String(orderId), true) // Skip confirm for returns tab
                            }
                          }}
                        >
                          {/* Order No and Date Row */}
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex flex-col">
                            <div className="font-semibold text-black text-sm">
                              {order.sales_order_id || '—'}
                              </div>
                              {order.sales_invoice_id && (
                                <div className="text-gray-700 text-[10px] mt-0.5">
                                  {order.sales_invoice_id}
                                </div>
                              )}
                            </div>
                            <div className="text-gray-600 text-xs">
                              {formatDate(creationDate)}
                            </div>
                          </div>

                          {/* Customer Name and Amount Row */}
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-700 font-medium text-xs">
                              {order.customer_name || '—'}
                            </span>
                            <span className="font-bold text-green-600 text-sm">
                              {typeof order.grand_total === 'number' 
                                ? `${order.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencySymbol}`
                                : '—'}
                            </span>
                          </div>

                          {/* Total Qty Row */}
                          <div className="mb-2">
                            <span className="text-gray-600 font-medium text-xs">
                              Qty: {order.total_qty ?? '—'}
                            </span>
                          </div>

                          {/* Invoice Status and Reverse Status Row */}
                          <div className="flex items-center gap-2">
                            {order.invoice_status && (
                              <span
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  order.invoice_status === 'Overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : order.invoice_status === 'Paid'
                                      ? 'bg-green-100 text-green-700'
                                      : order.invoice_status === 'Draft'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {order.invoice_status}
                              </span>
                            )}
                            {order.custom_reverse_status && order.custom_reverse_status !== 'No' && (
                              <span className="text-xs px-2 py-1 rounded-full font-medium bg-purple-100 text-purple-700">
                                {order.custom_reverse_status}
                              </span>
                            )}
                            {!order.invoice_status && (!order.custom_reverse_status || order.custom_reverse_status === 'No') && (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  {!ordersTabLoading && !ordersTabError && filteredReturns.length === 0 && (
                    <div className="text-xs text-gray-500 text-center py-4">No returns found</div>
                  )}
                  <div className="flex items-center justify-between pt-3">
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setReturnsPage((p) => Math.max(1, p - 1))}
                      disabled={returnsPage <= 1}
                    >
                      Prev
                    </button>
                    <div className="text-xs text-gray-600">Page {returnsPage}</div>
                    <button
                      className="px-3 py-1 text-xs border rounded disabled:opacity-40"
                      onClick={() => setReturnsPage((p) => p + 1)}
                      disabled={filteredReturns.length < pageLength}
                    >
                      Next
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">{returnsTotal} results found</span>
                    <select
                      value={pageLength}
                      onChange={e => setPageLength(Number(e.target.value))}
                      className="text-xs border rounded px-2 py-1"
                    >
                      {pageSizeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt} / page</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Placeholder only for tabs not yet implemented */}
      {activeTab === 'payments' && <PaymentTab />}
      
      {/* Loading overlay when opening order */}
      {isOpeningOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="glass-effect rounded-2xl p-8 text-center">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-700 font-medium">Loading order data...</p>
            <p className="text-sm text-gray-500 mt-2">Fetching order details, customer history, and related information</p>
          </div>
        </div>
      )}
      
      {/* Order open confirmation dialog */}
      <Dialog open={showOpenOrderConfirm} onOpenChange={(v) => {
        if (!v) {
          setShowOpenOrderConfirm(false)
          setPendingOrderData(null)
        }
      }}>
        <DialogContent 
          className="max-w-sm" 
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              openOrderConfirmBtnRef.current?.focus()
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              openOrderCancelBtnRef.current?.focus()
            } else if (e.key === 'Enter') {
              e.preventDefault()
              const activeElement = document.activeElement
              if (activeElement instanceof HTMLButtonElement) {
                activeElement.click()
              }
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Open Order?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Do you want to open order {pendingOrderData?.orderName || pendingOrderData?.orderId || ''}?
          </p>
          <DialogFooter>
            <Button
              ref={openOrderConfirmBtnRef}
              onClick={handleConfirmOpenOrder}
              autoFocus
              className="flex items-center gap-2"
            >
              Confirm
            </Button>
            <Button 
              ref={openOrderCancelBtnRef} 
              variant="outline" 
              onClick={() => {
                setShowOpenOrderConfirm(false)
                setPendingOrderData(null)
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RightPanel
