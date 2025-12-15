import React from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { ShoppingCart, Package, ShoppingBag } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MainLayoutProps {
    children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
    const { pathname } = useLocation()

    const tabs = [
        {
            id: 'sales',
            label: 'Sales',
            icon: ShoppingCart,
            path: '/pos',
            activeMatcher: (path: string) => path === '/pos' || path === '/pos/'
        },
        {
            id: 'picking',
            label: 'Dynamic Picking',
            icon: Package,
            path: '/picking',
            activeMatcher: (path: string) => path.startsWith('/picking')
        },
        {
            id: 'purchase',
            label: 'Purchase',
            icon: ShoppingBag,
            path: '/purchase',
            activeMatcher: (path: string) => path.startsWith('/purchase')
        }
    ]

    return (
        <div className="flex flex-col h-screen w-screen bg-background">
            {/* Top Navigation Bar */}
            <div className="h-12 border-b bg-card flex items-center px-4 gap-2 shadow-sm flex-shrink-0 z-10">
                <div className="flex items-center gap-1 mr-6">
                    <div className="h-8 w-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold text-lg">
                        C
                    </div>
                    <span className="font-bold text-lg">CentroPOS</span>
                </div>

                <nav className="flex items-center gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const isActive = tab.activeMatcher(pathname)

                        return (
                            <Link
                                key={tab.id}
                                to={tab.path}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    )
}

export default MainLayout
