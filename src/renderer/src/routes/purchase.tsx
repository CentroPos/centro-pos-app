import ProtectedLayout from '@renderer/components/hocs/ProtectedLayout'
import MainLayout from '@renderer/components/layout/MainLayout'
import PurchaseInterface from '@renderer/components/layout/purchase-Interface'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/purchase')({
    component: () => (
        <ProtectedLayout>
            <MainLayout>
                <PurchaseInterface />
            </MainLayout>
        </ProtectedLayout>
    )
})
