import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      closeButton
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--error-bg': 'white',
          '--error-text': 'black',
          '--error-border': '#dc2626'
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)',
        },
        error: {
          style: {
            background: 'white',
            color: 'black',
            border: '1px solid #dc2626',
          },
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
