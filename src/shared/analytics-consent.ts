import type { AppSettings } from './types'

// Change only when the disclosed data practices require a new decision.
export const ANALYTICS_CONSENT_VERSION = 1

export function needsAnalyticsConsent(settings: Partial<AppSettings>) {
  return settings.analyticsConsentVersion !== ANALYTICS_CONSENT_VERSION
}

export function analyticsAllowed(settings: Partial<AppSettings>) {
  return !needsAnalyticsConsent(settings) && settings.analyticsEnabled === true
}

export function consentDecision(
  settings: AppSettings,
  enabled: boolean,
): AppSettings {
  return {
    ...settings,
    analyticsEnabled: enabled,
    analyticsConsentVersion: ANALYTICS_CONSENT_VERSION,
  }
}
