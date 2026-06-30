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
        style: {
          position: 'fixed',
          top: `${50 + (index * 2)}%`, // Offset slightly from center for stacking
          left: '50%',
          transform: 'translate(-50%, -50%)',
          maxWidth: '450px', 
          minWidth: '300px', 
          fontSize: '14px', 
          fontWeight: 'normal', 
          padding: '16px', 
          textAlign: 'center', 
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          border: '1px solid #ef4444', 
          borderRadius: '8px', 
          zIndex: 10000 + index,
          pointerEvents: 'auto'
        }
        // Removed action button - using only the corner close symbol
      })
    }, index * 50) // Reduced delay for faster appearance
  })
}

/**
 * Transform common ERPNext errors into user-friendly messages
 */
function makeErrorUserFriendly(message: string): string {
  // Payment Terms Due Date error
  if (message.includes('Due Date') && message.includes('Payment Terms') && message.includes('cannot be before Posting Date')) {
    return 'Payment Terms Error: The payment terms due date cannot be before the posting date.\n\n' +
           'What to do:\n' +
           '• Check the payment terms template assigned to this customer\n' +
           '• Ensure the due date is on or after the posting date\n' +
           '• Contact your administrator to update the payment terms if needed'
  }
  
  // Warehouse not found error
  if (message.includes('Could not find Row') && message.includes('Delivery Warehouse')) {
    return 'Warehouse Error: The warehouse specified for this item was not found.\n\n' +
           'What to do:\n' +
           '• The warehouse may have been deleted or renamed\n' +
           '• Contact your administrator to check warehouse settings'
  }

  // Generic validation error often used for stock
  if (message.toLowerCase().includes('item validation failed') && (message.toLowerCase().includes('stock') || message.toLowerCase().includes('available'))) {
    return 'Not enough stock available'
  }

  // Stock unavailable or quantity errors
  const lowerMsg = message.toLowerCase()
  if (
    lowerMsg.includes('global stock unavailable') || 
    lowerMsg.includes('insufficient stock') ||
    (lowerMsg.includes('qty') && lowerMsg.includes('available'))
  ) {
    const itemMatch = message.match(/Item\s+([a-zA-Z0-9_-]+)/i)
    const availableMatch = message.match(/Available[:\s]*([\d.]+)/i)
    const requiredMatch = message.match(/Required[:\s]*([\d.]+)/i)

    let friendly = 'You do not have enough stock available for this item.'
    if (itemMatch) {
      friendly = `You do not have enough stock available for the item: ${itemMatch[1]}.`
    }
    
    if (availableMatch && requiredMatch) {
      friendly += `\n(You only have ${parseFloat(availableMatch[1])} left, but you are trying to sell ${parseFloat(requiredMatch[1])})`
    }
    
    return friendly
  }
  
  // Duplicate Reference error formatting
  if (message.includes('Duplicate Reference') || lowerMsg.includes('already exists') || lowerMsg.includes('duplicate')) {
    
    // Extract the exact sentence from the backend if it's there
    const extractMatch = message.match(/A Purchase entry already exists for Supplier [^"\\]+/i)
    if (extractMatch) {
      return extractMatch[0]
    }

    // Fallback if the specific sentence isn't found
    const match = message.match(/^([a-zA-Z0-9_-]+)\.\s*[\[\{]/i)
    const refId = match ? match[1] : ''
    
    let friendly = 'Duplicate Reference Error: A document with this Reference ID already exists.'
    if (refId) {
      friendly = `Duplicate Reference Error: A document with the Reference ID "${refId}" already exists.`
    } else if (!message.includes('{') && !message.includes('[')) {
      friendly = message
    }
    
    return friendly
  }
  
  // Return original message if no transformation needed
  return message
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
        // Transform to user-friendly message
        const friendlyMessage = makeErrorUserFriendly(message)
        formattedMessages.push(friendlyMessage)
      } catch (parseError) {
        // If parsing fails, try to use the item as a string or its string representation
        let rawMessage: string
        if (typeof messageItem === 'string') {
          rawMessage = messageItem
        } else if (messageItem && typeof messageItem === 'object' && messageItem.message) {
          rawMessage = messageItem.message
        } else {
          rawMessage = String(messageItem)
        }
        // Transform to user-friendly message
        const friendlyMessage = makeErrorUserFriendly(rawMessage)
        formattedMessages.push(friendlyMessage)
      }
    })

    // Combine all messages into a single formatted string
    const combinedMessage = formattedMessages.join('\n\n')
    
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

    // Display in a single toast popup with longer duration for detailed messages
    const isDetailedMessage = combinedMessage.includes('What to do:') || combinedMessage.split('\n').length > 3
    toast.error(combinedMessage, {
      duration: isDetailedMessage ? 12000 : 8000, // Show longer for detailed messages
      description: title !== 'Error' ? title : undefined,
      style: {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        maxWidth: '550px', 
        minWidth: '400px', 
        fontSize: '14px', 
        fontWeight: 'normal', 
        padding: '20px', 
        textAlign: 'center', 
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        border: '1px solid #ef4444', 
        borderRadius: '8px', 
        whiteSpace: 'pre-line',
        lineHeight: '1.5' 
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
/**
 * Formats an error message to be more readable
 */
function formatMessage(message: string): { mainMessage: string; details: string } {
  const cleanMessage = message
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<ul>/gi, '\n')
    .replace(/<\/ul>/gi, '')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  const lines = cleanMessage.split('\n')
  const mainMessage = lines[0] || message
  const details = lines.slice(1).join('\n').trim()

  return { mainMessage, details }
}

/**
 * Show a large, centered user-friendly error popup
 */
export function showErrorPopup(message: string, title?: string) {
  const { mainMessage, details } = formatMessage(message)
  const friendlyMessage = makeErrorUserFriendly(mainMessage)
  const combinedMessage = details ? `${friendlyMessage}\n\n${details}` : friendlyMessage
  const isDetailedMessage = combinedMessage.includes('What to do:') || combinedMessage.split('\n').length > 3

  toast.error(combinedMessage, {
    duration: isDetailedMessage ? 12000 : 8000,
    description: title && title !== 'Error' ? title : undefined,
    style: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'auto',
      maxWidth: '550px',
      minWidth: '400px',
      fontSize: '14px',
      fontWeight: 'normal',
      padding: '20px',
      textAlign: 'center',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      border: '1px solid #ef4444',
      borderRadius: '8px',
      whiteSpace: 'pre-line',
      lineHeight: '1.5',
      zIndex: 99999
    }
  })
}

/**
 * Unified error handler for all types of errors (Backend, Axios, string, Error object)
 */
export function handleError(error: any, fallbackMessage: string = 'An unexpected error occurred') {
  console.error('Unified Error Handler caught:', error)

  // Check if it's a server message with _server_messages
  const serverMessages = error?.response?.data?._server_messages || error?._server_messages || error?.data?._server_messages
  if (serverMessages) {
    try {
      handleServerErrorMessages(serverMessages)
      return
    } catch (e) {
      console.warn('Failed to handle server messages, falling back to standard error handling')
    }
  }

  // Extract message from various error formats
  let message = ''
  let title = 'Error'

  if (typeof error === 'string') {
    message = error
  } else if (error instanceof Error) {
    message = error.message
  } else if (error?.message) {
    message = error.message
    title = error.title || 'Error'
  } else if (error?.error) {
    message = error.error
  } else {
    message = fallbackMessage
  }

  // Handle network errors specifically
  if (error?.code === 'ERR_NETWORK' || error?.message?.includes('Network Error')) {
    showErrorPopup('Network connection issue. Please check your internet connection and the server status.', 'Network Error')
    return
  }

  // Finally show the popup
  showErrorPopup(message, title)
}
