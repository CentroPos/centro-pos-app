import React, { useState, useEffect, useRef, useCallback } from 'react'

interface ErrorMessage {
  message: string
  title: string
  indicator: string
  itemCode: string
  idx?: number
}

interface BottomErrorBoxProps {
  errors: ErrorMessage[]
  isVisible: boolean
  onClose: () => void
  onFocusChange?: (isFocused: boolean) => void
  onFocusItem?: (itemCode: string, idx?: number) => void
}

const BottomErrorBox: React.FC<BottomErrorBoxProps> = ({
  errors,
  isVisible,
  onClose,
  onFocusChange,
  onFocusItem
}) => {
  const [currentErrorIndex, setCurrentErrorIndex] = useState(0)
  const errorBoxRef = useRef<HTMLDivElement>(null)

  const goToPreviousError = useCallback(() => {
    setCurrentErrorIndex((prev) => (prev > 0 ? prev - 1 : errors.length - 1))
  }, [errors.length])

  const goToNextError = useCallback(() => {
    setCurrentErrorIndex((prev) => (prev < errors.length - 1 ? prev + 1 : 0))
  }, [errors.length])

  const handleErrorClick = useCallback(() => {
    const currentError = errors[currentErrorIndex]
    if (currentError?.itemCode && onFocusItem) {
      onFocusItem(currentError.itemCode, currentError.idx)
    }
  }, [currentErrorIndex, errors, onFocusItem])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (errors.length <= 1) return

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        goToPreviousError()
      } else if (event.key === 'ArrowDown') {
        event.preventDefault()
        goToNextError()
      }
    }

    const currentRef = errorBoxRef.current
    if (currentRef) {
      currentRef.addEventListener('keydown', handleKeyDown)
      currentRef.focus()
    }

    return () => {
      if (currentRef) {
        currentRef.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [goToPreviousError, goToNextError, errors.length])

  if (!isVisible || errors.length === 0) {
    return null
  }

  const currentError = errors[currentErrorIndex]
  const hasMultipleErrors = errors.length > 1

  // Format the error message to remove HTML tags and make it readable
  const formatErrorMessage = (message: string) => {
    return message
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .trim()
  }

  return (
    <div
      ref={errorBoxRef}
      tabIndex={0}
      className="bg-red-50 border border-red-200 rounded-lg p-4 mx-2 mt-6 mb-0 shadow-sm relative focus:outline-none focus:ring-2 focus:ring-red-300"
      onFocus={() => onFocusChange?.(true)}
      onBlur={() => onFocusChange?.(false)}
    >
      {/* Close Button - Small X in corner */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
        title="Close errors"
      >
        <span className="text-sm font-bold">×</span>
      </button>

      <div className="flex items-start justify-between pr-4">
        <div className="flex items-start space-x-3 flex-1">
          {/* Error Icon */}
          <div className="flex-shrink-0">
            <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <i className="fas fa-exclamation text-white text-xs"></i>
            </div>
          </div>

          {/* Error Content */}
          <div
            className="flex-1 min-w-0 cursor-pointer hover:bg-red-100 rounded p-2 transition-colors"
            onClick={handleErrorClick}
            title="Click to focus on this item in the table"
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-red-800">
                {currentError.title || 'Error'}
                {currentError.idx !== undefined && (
                  <span className="ml-2 text-xs font-normal text-red-600">
                    (S.No: {currentError.idx})
                  </span>
                )}
              </h4>
              {hasMultipleErrors && (
                <span className="text-xs text-red-700 bg-red-200 px-2 py-1 rounded-full font-medium">
                  {currentErrorIndex + 1} of {errors.length}
                </span>
              )}
            </div>

            <div className="text-sm text-red-700 whitespace-pre-line">
              {formatErrorMessage(currentError.message)}
            </div>
          </div>

          {/* Navigation Arrows */}
          {hasMultipleErrors && (
            <div className="flex flex-col space-y-2 flex-shrink-0">
              <button
                onClick={goToPreviousError}
                className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                title="Previous error"
              >
                <span className="text-sm">▲</span>
              </button>
              <button
                onClick={goToNextError}
                className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 transition-colors"
                title="Next error"
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

export default BottomErrorBox
