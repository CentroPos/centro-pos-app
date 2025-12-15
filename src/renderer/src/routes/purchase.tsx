import ProtectedLayout from '@renderer/components/hocs/ProtectedLayout'
import MainLayout from '@renderer/components/layout/MainLayout'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/purchase')({
    component: () => (
        <ProtectedLayout>
            <MainLayout>
                <div className="flex items-center justify-center h-full bg-slate-50">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-800">Purchase</h1>
                        <p className="text-gray-500 mt-2">Feature coming soon...</p>
                    </div>
                </div>
            </MainLayout>
        </ProtectedLayout>
    )
})
