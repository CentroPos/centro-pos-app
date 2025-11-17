import React, { useState, useEffect, useRef, useCallback } from 'react'

interface ZatcaResponse {
  invoice_no?: string
  status?: string
  status_code?: string
  response?: {
    type?: string
    code?: string
    category?: string
    message?: string
    status?: string
    [key: string]: any // Allow other fields
  }
  [key: string]: any // Allow other fields in the response
}

interface BottomZatcaBoxProps {
  zatcaResponses: ZatcaResponse[]
  isVisible: boolean
  onClose: () => void
  onFocusChange?: (isFocused: boolean) => void
}

const BottomZatcaBox: React.FC<BottomZatcaBoxProps> = ({
  zatcaResponses,
  isVisible,
  onClose,
  onFocusChange
}) => {
  const [currentResponseIndex, setCurrentResponseIndex] = useState(0)
  const zatcaBoxRef = useRef<HTMLDivElement>(null)

  const goToPreviousResponse = useCallback(() => {
    setCurrentResponseIndex((prev) => (prev > 0 ? prev - 1 : zatcaResponses.length - 1))
  }, [zatcaResponses.length])

  const goToNextResponse = useCallback(() => {
    setCurrentResponseIndex((prev) => (prev < zatcaResponses.length - 1 ? prev + 1 : 0))
  }, [zatcaResponses.length])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (zatcaResponses.length <= 1) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        goToPreviousResponse()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        goToNextResponse()
      }
    }

    const currentRef = zatcaBoxRef.current
    if (currentRef) {
      currentRef.addEventListener('keydown', handleKeyDown)
      currentRef.focus()
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [goToPreviousResponse, goToNextResponse, zatcaResponses.length])

  if (!isVisible || zatcaResponses.length === 0) {
    return null
  }

  const currentResponse = zatcaResponses[currentResponseIndex]
  const hasMultipleResponses = zatcaResponses.length > 1

  // Format ZATCA response data for display - show only message and type from response object
  const formatZatcaResponse = (response: ZatcaResponse): string => {
    const parts: string[] = []
    
    if (response.response) {
      const resp = response.response
      // Show type first, then message
      if (resp.type) {
        parts.push(`Type: ${resp.type}`)
      }
      if (resp.message) {
        parts.push(`Message: ${resp.message}`)
      }
    }
    
    // If no response object, show a fallback message
    if (parts.length === 0) {
      parts.push('ZATCA Response received')
    }
    
    return parts.join('\n')
  }

  return (
    <div
      ref={zatcaBoxRef}
      tabIndex={0}
      className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mx-2 mt-6 mb-0 shadow-sm relative focus:outline-none focus:ring-2 focus:ring-yellow-400"
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    >
      {/* Close Button - Small X in corner */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-yellow-600 hover:text-yellow-800 transition-colors"
        title="Close ZATCA response"
      >
        <span className="text-sm font-bold">×</span>
      </button>

      <div className="flex items-start justify-between pr-4">
        <div className="flex items-start space-x-3 flex-1">
          {/* Warning Icon */}
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
              <i className="fas fa-exclamation-triangle text-white text-xs"></i>
            </div>
          </div>

          {/* ZATCA Response Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-yellow-800">
                ZATCA Response
              </h4>
              {hasMultipleResponses && (
                <span className="text-xs text-yellow-700 bg-yellow-200 px-2 py-1 rounded-full font-medium">
                  {currentResponseIndex + 1} of {zatcaResponses.length}
                </span>
              )}
            </div>

            <div className="text-sm text-yellow-800 whitespace-pre-line font-mono">
              {formatZatcaResponse(currentResponse)}
            </div>
          </div>

          {/* Navigation Arrows */}
          {hasMultipleResponses && (
            <div className="flex flex-col space-y-2 flex-shrink-0">
              <button
                onClick={goToPreviousResponse}
                className="w-6 h-6 flex items-center justify-center text-yellow-600 hover:text-yellow-800 transition-colors"
                title="Previous response"
              >
                <span className="text-sm">▲</span>
              </button>
              <button
                onClick={goToNextResponse}
                className="w-6 h-6 flex items-center justify-center text-yellow-600 hover:text-yellow-800 transition-colors"
                title="Next response"
              >
                <span className="text-sm">▼</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BottomZatcaBox

