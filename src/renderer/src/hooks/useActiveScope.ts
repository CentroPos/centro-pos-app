import { useEffect } from 'react'
import { useHotkeyScopeStore } from '../store/useHotkeyScopeStore'

export const useActiveScope = (scope: string) => {
  const pushScope = useHotkeyScopeStore((state) => state.pushScope)
  const popScope = useHotkeyScopeStore((state) => state.popScope)

  useEffect(() => {
    pushScope(scope)
    return () => {
      popScope(scope)
    }
  }, [scope, pushScope, popScope])
}
