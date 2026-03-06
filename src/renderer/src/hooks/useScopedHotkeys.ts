import { useHotkeys as useOriginalHotkeys, Options } from 'react-hotkeys-hook'
import { useHotkeyScopeStore } from '../store/useHotkeyScopeStore'
import { KeyboardEvent } from 'react'

export const useScopedHotkeys = (
  keys: string | readonly string[],
  callback: (e: KeyboardEvent, handler: any) => void,
  options: Options = {},
  deps: any[] = [],
  scope: string = 'global'
) => {
  const isScopeActive = useHotkeyScopeStore((state) => state.isScopeActive)

  // Check if our scope is currently active
  const isActive = isScopeActive(scope)

  // Merge the `enabled` option with our active check
  const originalEnabled = options.enabled !== undefined ?
    // @ts-ignore
    (typeof options.enabled === 'function' ? options.enabled() : options.enabled)
    : true

  const finalEnabled = originalEnabled && isActive

  const finalDeps = deps ? [...deps, finalEnabled] : [finalEnabled]

  useOriginalHotkeys(
    keys,
    (e, handler) => {
      callback(e as unknown as KeyboardEvent, handler)
    },
    {
      ...options,
      enabled: finalEnabled
    },
    finalDeps
  )
}
