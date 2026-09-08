export type Level = 'A1' | 'A2' | 'B1'
export interface Organization {
  id: string
  name: string
  code: string
  active: boolean
  createdAt: number
  updatedAt: number
  connectedInstallations?: number
}
export interface CreateOrganization {
  name: string
  code: string
  active?: boolean
}
export type PatchOrganization = Partial<CreateOrganization>
export interface OrganizationsResponse {
  organizations: Organization[]
}
export interface ConnectRequest {
  installationId: string
  code: string
}
export interface ConnectResponse {
  organization: Pick<Organization, 'id' | 'name' | 'code'>
  extraVocabularyEnabled: true
}
export interface RemoteWord {
  id: string
  kk: string
  ru: string
  level: Level
}
export interface RemoteVocabulary {
  id: string
  name: string
  description?: string
  level: Level
  version: number
  requiresOrganization: boolean
  updatedAt: number
  words: RemoteWord[]
}
export interface RemoteVocabularyCatalog {
  protocolVersion: 1
  version: number
  vocabularies: RemoteVocabulary[]
}
export type AnalyticsEventType =
  | 'onboarding_started'
  | 'onboarding_step_completed'
  | 'onboarding_completed'
  | 'organization_connected'
  | 'dictionary_activated'
  | 'study_session_started'
  | 'study_card_rated'
  | 'study_session_completed'
  | 'challenge_completed'
  | 'challenge_skipped'
interface AnalyticsEventFields {
  id: string
  installationId: string
  occurredAt: number
  sessionId?: string
  organizationId?: string
  vocabularyId?: string
  wordId?: string
  durationMs?: number
  confidence?: -2 | -1 | 0 | 1 | 2
  correct?: boolean
  onboardingStep?: string
}
type WithFields<K extends keyof AnalyticsEventFields> = Required<
  Pick<AnalyticsEventFields, K>
>
export type AnalyticsEventV2 = AnalyticsEventFields &
  (
    | { type: 'onboarding_started' | 'onboarding_completed' }
    | ({ type: 'onboarding_step_completed' } & WithFields<'onboardingStep'>)
    | ({ type: 'organization_connected' } & WithFields<'organizationId'>)
    | ({ type: 'dictionary_activated' } & WithFields<'vocabularyId'>)
    | ({
        type: 'study_session_started' | 'study_session_completed'
      } & WithFields<'sessionId' | 'vocabularyId'>)
    | ({ type: 'study_card_rated' } & WithFields<
        'sessionId' | 'vocabularyId' | 'wordId' | 'confidence' | 'durationMs'
      >)
    | ({ type: 'challenge_completed' } & WithFields<
        'vocabularyId' | 'wordId' | 'correct' | 'durationMs'
      >)
    | ({ type: 'challenge_skipped' } & WithFields<'vocabularyId' | 'wordId'>)
  )
export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'CODE_NOT_FOUND'
  | 'CODE_DISABLED'
  | 'ORGANIZATION_CODE_CONFLICT'
  | 'VOCABULARY_NOT_FOUND'
  | 'INVALID_XLSX'
  | 'IMPORT_VALIDATION_FAILED'
  | 'PAYLOAD_TOO_LARGE'
  | 'ORGANIZATION_NOT_FOUND'
  | 'INTERNAL_ERROR'
export interface ImportRowError {
  row: number
  field: string
  code:
    | 'REQUIRED'
    | 'DUPLICATE_ID'
    | 'INVALID_LEVEL'
    | 'FORMULA_NOT_ALLOWED'
    | 'INVALID_HEADER'
    | 'TOO_MANY_ROWS'
  message: string
}
export interface ProtocolError {
  error: {
    code: ErrorCode
    message: string
    fields: Record<string, ImportRowError[]>
  }
}
export interface ImportResponse {
  vocabularyId: string
  version: number
  imported: number
}
export interface AnalyticsBatchRequest {
  events: AnalyticsEventV2[]
}
export interface AnalyticsBatchResponse {
  accepted: number
  duplicates: number
  rejected: {
    id: string
    code: 'INVALID_REQUEST' | 'ORGANIZATION_NOT_FOUND' | 'VOCABULARY_NOT_FOUND'
  }[]
}
