import React, { useState } from 'react'
import { useAuthStore } from '@renderer/store/useAuthStore'
import { usePOSTabStore } from '@renderer/store/usePOSTabStore'
import { usePOSProfileStore } from '@renderer/store/usePOSProfileStore'

const ProfileDropdown: React.FC = () => {
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [appVersion, setAppVersion] = useState<string>('')
    const { user: profile, logout } = useAuthStore() // Accessing user as profile matches existing logic
    const { clearAllTabs } = usePOSTabStore()
    const { profile: posProfile } = usePOSProfileStore()

    // Load app version
    React.useEffect(() => {
        const loadVersion = async () => {
            try {
                const api = window.electronAPI?.app
                if (api?.getVersion) {
                    const version = await api.getVersion()
                    if (version) setAppVersion(version)
                }
            } catch (error) {
                console.warn('Failed to load app version', error)
            }
        }
        loadVersion()
    }, [])

    // Fallback profile name if auth store user is missing but we have posProfile
    const displayProfile = profile || (posProfile?.applicable_for_users?.[0] ? { name: posProfile.applicable_for_users[0].user || 'User' } : null)
    const profileName = displayProfile?.name || 'User'
    const profileInitial = profileName.substring(0, 2).toUpperCase()

    const handleLogout = async () => {
        try {
            console.log('1. Calling logout from store...')
            logout()

            console.log('3. Calling proxy logout...')
            await window.electronAPI?.proxy?.logout()

            console.log('5. Clearing POS tab state...')
            clearAllTabs()
            localStorage.removeItem('pos-tab-store')
            const tabStorePersist = (usePOSTabStore as any).persist
            if (tabStorePersist?.clearStorage) {
                await tabStorePersist.clearStorage()
            }

            console.log('7. Clearing authentication data...')
            localStorage.removeItem('userData')
            localStorage.removeItem('auth-store')

            setShowProfileDropdown(false)

            console.log('10. Reloading page to login...')
            window.location.href = '/'
        } catch (error) {
            console.error('=== DROPDOWN LOGOUT FAILED ===', error)
            setShowProfileDropdown(false)
            localStorage.removeItem('userData')
            localStorage.removeItem('auth-store')
            clearAllTabs()
            localStorage.removeItem('pos-tab-store')
            const tabStorePersistFallback = (usePOSTabStore as any).persist
            if (tabStorePersistFallback?.clearStorage) {
                await tabStorePersistFallback.clearStorage()
            }
            window.location.href = '/'
        }
    }

    return (
        <div className="relative ml-2 mr-2 flex items-center">
            <button
                className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-semibold hover:from-blue-600 hover:to-purple-700 transition-all"
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            >
                {profileInitial}
            </button>

            {/* Profile Dropdown */}
            {showProfileDropdown && (
                <div
                    className="absolute right-0 top-10 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-48 z-50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-4 py-2 border-b border-gray-100">
                        <div className="text-sm font-semibold text-gray-800">
                            {profileName}
                        </div>
                        {appVersion && (
                            <div className="text-xs text-gray-500 mt-1">
                                Version {appVersion}
                            </div>
                        )}
                    </div>
                    <button
                        className="w-full px-4 py-2 text-left text-sm font-semibold text-black hover:bg-gray-100 transition-colors"
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleLogout()
                        }}
                    >
                        Logout
                    </button>
                </div>
            )}

            {/* Click outside listener could be added here or handled by parent */}
            {showProfileDropdown && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setShowProfileDropdown(false)}
                />
            )}
        </div>
    )
}

export default ProfileDropdown
