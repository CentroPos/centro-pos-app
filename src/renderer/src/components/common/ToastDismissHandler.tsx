import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * Component that dismisses all active toasts when any global user interaction occurs
 * (mouse movement, clicks, key presses, or scrolling).
 */
export function ToastDismissHandler() {
    const lastEventTime = useRef<number>(0)
    const DISMISS_THRESHOLD = 500 // Min time in ms between toast appearing and dismissal via move

    useEffect(() => {
        const handleDismiss = (event: Event) => {
            // Avoid immediate dismissal if the event happened too close to the toast appearing
            // or if it's a mousemove (to allow some grace period)
            const now = Date.now()

            // If it's a mousemove, we want a slight threshold to prevent "jitter" dismissal
            // but still feel responsive. 
            if (event.type === 'mousemove') {
                // We only dismiss on mousemove if there are active toasts 
                // Sonner doesn't easily expose "active toast count", but toast.dismiss() is safe to call.
                // To be safe and avoid constant dismiss calls, we check time.
                if (now - lastEventTime.current < DISMISS_THRESHOLD) return
            }

            toast.dismiss()
            lastEventTime.current = now
        }

        // List of events that should trigger dismissal
        const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel']

        // Attach listeners
        events.forEach(eventName => {
            window.addEventListener(eventName, handleDismiss, { passive: true })
        })

        // Cleanup
        return () => {
            events.forEach(eventName => {
                window.removeEventListener(eventName, handleDismiss)
            })
        }
    }, [])

    return null // This is a logic-only component
}
