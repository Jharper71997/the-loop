'use client'

// Rider-side business detection for the shared (external) chrome.
//
// The Brew rider PWA lives at '/', Surf City at '/surfcity'. The shared chrome
// (TopBar, TabBar, LiveStatusStrip, PwaShell) calls useRiderBusiness() to swap
// brand strings + prefix internal links, so one set of components serves both.

import { usePathname } from 'next/navigation'
import { businessFromPath } from './businessConfig'

export function useRiderBusiness() {
  return businessFromPath(usePathname())
}
