import { toast } from 'sonner'

export interface ServerMessage {
  message: string
  title: string
  indicator: string
  raise_exception: number
  __frappe_exc_id: string
}

export interface ParsedError {
  message: string
  title: string
  indicator: string
}

/**
 * Split validation errors from a single message string
 */
function splitValidationErrors(message: string): string[] {
  console.log('🔍 Splitting validation errors from message:', message)

  // Clean up the message first
  let cleanedMessage = message
    .replace(/<br\s*\/?>/gi, '. ') // Replace <br> tags with periods
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()

  console.log('🔍 Cleaned message:', cleanedMessage)

  // More specific patterns to split validation errors
  const errorPatterns = [
    // Split at period-comma-space followed by specific validation keywords
    /\.\s*,\s*(?=Invalid format or value for:)/g,
    /\.\s*,\s*(?=Missing mandatory fields:)/g,
    /\.\s*,\s*(?=Buyer ID Type)/g,
    /\.\s*,\s*(?=Pincode must be)/g,
    /\.\s*,\s*(?=VAT Number)/g,
    // Split at period-space followed by specific validation keywords
    /\.\s+(?=Invalid format or value for:)/g,
    /\.\s+(?=Missing mandatory fields:)/g,
    /\.\s+(?=Buyer ID Type)/g,
    /\.\s+(?=Pincode must be)/g,
    /\.\s+(?=VAT Number)/g,
    // Split at comma-space followed by specific validation keywords
    /,\s+(?=Invalid format or value for:)/g,
    /,\s+(?=Missing mandatory fields:)/g,
    /,\s+(?=Buyer ID Type)/g,
    /,\s+(?=Pincode must be)/g,
    /,\s+(?=VAT Number)/g,
    // General split at period-comma-space followed by capital letter
    /\.\s*,\s*(?=[A-Z])/g,
    // General split at period-space followed by capital letter
    /\.\s+(?=[A-Z])/g,
    // Split at comma-space followed by capital letter (but not within parentheses)
    /,\s+(?=[A-Z][a-z]+ [A-Z])/g
  ]

  let errors = [cleanedMessage]

  // Apply each pattern to further split the errors
  errorPatterns.forEach((pattern, index) => {
    const newErrors: string[] = []
    errors.forEach((error) => {
      const split = error.split(pattern)
      newErrors.push(...split.filter((e) => e.trim().length > 0))
    })
    errors = newErrors
    console.log(`🔍 After pattern ${index + 1}:`, errors)
  })

  // If we still have concatenated errors, try more aggressive splitting
  if (errors.length === 1 && (errors[0].includes(',') || errors[0].includes('.'))) {
    // Split by comma-space followed by capital letter
    const commaSplit = errors[0].split(/,\s+(?=[A-Z])/g)
    if (commaSplit.length > 1) {
      errors = commaSplit.filter((e) => e.trim().length > 0)
      console.log('🔍 After comma splitting:', errors)
    }

    // If still one error, try period splitting
    if (errors.length === 1) {
      const periodSplit = errors[0].split(/\.\s+(?=[A-Z])/g)
      if (periodSplit.length > 1) {
        errors = periodSplit.filter((e) => e.trim().length > 0)
        console.log('🔍 After period splitting:', errors)
      }
    }
  }

  // Clean up the errors
  const cleanedErrors = errors
    .map((error) => error.trim())
    .filter((error) => error.length > 0)
    .map((error) => {
      // Remove trailing periods, commas, and spaces
      return error.replace(/[.,\s]+$/, '').trim()
    })
    .filter((error) => error.length > 0)

  console.log('🔍 Final cleaned errors:', cleanedErrors)
  return cleanedErrors
}

/**
 * Parse server messages from _server_messages field
 */
export function parseServerMessages(serverMessagesString: string): ParsedError[] {
  try {
    const serverMessages = JSON.parse(serverMessagesString)
    if (!Array.isArray(serverMessages)) return []

    const allErrors: ParsedError[] = []

    serverMessages.forEach((messageStr: string) => {
      try {
        const messageObj = JSON.parse(messageStr) as ServerMessage
        const message = messageObj.message || 'Unknown error'
        const title = messageObj.title || 'Error'
        const indicator = messageObj.indicator || 'red'

        // Split the message into individual validation errors
        const splitErrors = splitValidationErrors(message)

        // Create a ParsedError for each split error
        splitErrors.forEach((errorMessage) => {
          allErrors.push({
            message: errorMessage,
            title: title,
            indicator: indicator
          })
        })
      } catch (parseError) {
        console.error('Error parsing individual server message:', parseError)
        // If parsing fails, try to split the raw string
        const splitErrors = splitValidationErrors(messageStr)
        splitErrors.forEach((errorMessage) => {
          allErrors.push({
            message: errorMessage,
            title: 'Error',
            indicator: 'red'
          })
        })
      }
    })

    console.log('🔍 Parsed errors:', allErrors)
    return allErrors
  } catch (error) {
    console.error('Error parsing server messages:', error)
    return []
  }
}

/**
 * Show multiple error messages as stacked popups simultaneously with compact spacing
 */
export function showStackedErrorPopups(errors: ParsedError[]) {
  if (errors.length === 0) return

  console.log('🚨 Showing stacked error popups:', errors)

  errors.forEach((error, index) => {
    console.log(`🚨 Showing error popup ${index + 1}/${errors.length}:`, error)

    // Use a small delay to ensure proper stacking order
    setTimeout(() => {
      toast.error(error.message, {
        duration: 8000, // Show for 8 seconds
        description: error.title !== 'Error' ? error.title : undefined,
        position: 'bottom-right', // Changed to bottom-right for stacking from bottom
        style: {
          marginBottom: `${index * 12}px`, // Small margin between each popup (12px spacing)
          marginRight: '0px', // No horizontal offset
          maxWidth: '400px', // Consistent width
          minWidth: '300px', // Minimum width for readability
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // Card-like shadow
          border: '1px solid #ef4444', // Red border to match error theme
          borderRadius: '8px', // Rounded corners like cards
          zIndex: 1000 + index, // Ensure proper stacking order
          position: 'fixed', // Fixed positioning for better control
          bottom: `${20 + (index * 12)}px`, // Fixed bottom position with small offset
          right: '20px', // Fixed right position
          opacity: '1', // Ensure always visible
          visibility: 'visible', // Ensure always visible
          pointerEvents: 'auto' // Ensure clickable
        }
        // Removed action button - using only the corner close symbol
      })
    }, index * 50) // Reduced delay for faster appearance
  })
}

/**
 * Handle server error messages - display in a single formatted toast in right bottom corner
 */
export function handleServerErrorMessages(
  serverMessagesString: string | undefined,
  fallbackMessage: string = ''
): void {
  if (!serverMessagesString) {
    // Only show fallback if provided, otherwise do nothing
    if (fallbackMessage) {
      toast.error(fallbackMessage)
      throw new Error(fallbackMessage) // Throw error to prevent further execution
    }
    return
  }

  console.log('🔍 Raw server messages string:', serverMessagesString)
  
  try {
    // Parse the server messages array
    const serverMessages = JSON.parse(serverMessagesString)
    if (!Array.isArray(serverMessages) || serverMessages.length === 0) {
      if (fallbackMessage) {
        toast.error(fallbackMessage)
        throw new Error(fallbackMessage)
      }
      return
    }

    // Extract all messages and format them
    const formattedMessages: string[] = []
    
    serverMessages.forEach((messageItem: any) => {
      try {
        // Check if messageItem is already an object or a string that needs parsing
        let messageObj: any
        if (typeof messageItem === 'string') {
          // If it's a string, parse it
          messageObj = JSON.parse(messageItem)
        } else {
          // If it's already an object, use it directly
          messageObj = messageItem
        }
        const message = messageObj.message || 'Unknown error'
        formattedMessages.push(message)
      } catch (parseError) {
        // If parsing fails, try to use the item as a string or its string representation
        if (typeof messageItem === 'string') {
          formattedMessages.push(messageItem)
        } else if (messageItem && typeof messageItem === 'object' && messageItem.message) {
          formattedMessages.push(messageItem.message)
        } else {
          formattedMessages.push(String(messageItem))
        }
      }
    })

    // Combine all messages into a single formatted string
    const combinedMessage = formattedMessages.join('\n')
    
    // Get title from first message if available
    let title = 'Error'
    try {
      const firstMessageItem = serverMessages[0]
      let firstMessage: any
      if (typeof firstMessageItem === 'string') {
        firstMessage = JSON.parse(firstMessageItem)
      } else {
        firstMessage = firstMessageItem
      }
      title = firstMessage.title || 'Error'
    } catch {
      // Use default title
    }

    console.log('🔍 Formatted server message:', combinedMessage)
    console.log('🔍 Message title:', title)

    // Display in a single toast popup
    toast.error(combinedMessage, {
      duration: 8000,
      description: title !== 'Error' ? title : undefined,
      position: 'bottom-right',
      style: {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        opacity: '1',
        visibility: 'visible',
        pointerEvents: 'auto',
        maxWidth: '500px',
        minWidth: '350px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        whiteSpace: 'pre-line' // Allow line breaks in the message
      }
    })
    
    throw new Error(combinedMessage) // Throw error to prevent further execution
  } catch (error) {
    console.error('Error parsing server messages:', error)
    // If parsing fails, show the raw string or fallback
    if (fallbackMessage) {
      toast.error(fallbackMessage)
      throw new Error(fallbackMessage)
    }
  }
}
