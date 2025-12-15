import ProtectedLayout from '@renderer/components/hocs/ProtectedLayout'
import MainLayout from '@renderer/components/layout/MainLayout'
import POSInterface from '@renderer/components/layout/pos-Interface'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pos')({
  component: () => (
    <ProtectedLayout>
      <MainLayout>
        <POSInterface />
      </MainLayout>
    </ProtectedLayout>
  )
})