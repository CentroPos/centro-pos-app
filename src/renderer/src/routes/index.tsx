import LoginInterface from '@renderer/components/layout/login-Interface'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: () => <LoginInterface />
})