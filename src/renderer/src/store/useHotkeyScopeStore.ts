import { create } from 'zustand'

interface HotkeyScopeState {
  // Stack of active scopes. The last element is the currently active (topmost) scope.
  activeScopes: string[]
  pushScope: (scope: string) => void
  popScope: (scope: string) => void
  // Helpful to check if a specific scope is the currently active one
  isScopeActive: (scope: string) => boolean
}

export const useHotkeyScopeStore = create<HotkeyScopeState>((set, get) => ({
  activeScopes: ['global'], // Default base scope

  pushScope: (scope: string) =>
    set((state) => {
      // If the scope is already the top one, no need to push
      if (state.activeScopes[state.activeScopes.length - 1] === scope) {
        return state
      }
      return { activeScopes: [...state.activeScopes, scope] }
    }),

  popScope: (scope: string) =>
    set((state) => {
      // Remove all instances of this scope from the stack, 
      // or perfectly pop the top one if it matches. 
      // We filter it out to ensure it's removed even if something else was pushed on top improperly.
      const newScopes = state.activeScopes.filter((s) => s !== scope)
      // Ensure 'global' is always at the bottom
      if (newScopes.length === 0) {
        newScopes.push('global')
      }
      return { activeScopes: newScopes }
    }),

  isScopeActive: (scope: string) => {
    const scopes = get().activeScopes
    return scopes.length > 0 && scopes[scopes.length - 1] === scope
  }
}))
