import ProtectedLayout from '@renderer/components/hocs/ProtectedLayout'
import MainLayout from '@renderer/components/layout/MainLayout'
import { createFileRoute } from '@tanstack/react-router'
import DynamicPickupInterface from './dynamic_picking'

export const Route = createFileRoute('/picking')({
    component: () => (
        <ProtectedLayout>
            <MainLayout>
                <DynamicPickupInterface />
            </MainLayout>
        </ProtectedLayout>
    )
})
