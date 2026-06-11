export type UserRole = 'admin' | 'operator' | 'auditor'

export type AuditStatus = 'normal' | 'need_supply' | 'need_review' | 'pending'

export type RectificationStatus = 'pending' | 'in_progress' | 'completed' | 'closed'

export interface RectificationTask {
  id: string
  itemId: string
  requirement: string
  assignee: string
  planCompleteAt: number | null
  status: RectificationStatus
  createdBy: string
  createdAt: number
  updatedAt: number
  closedBy?: string
  closedAt?: number
  history: RectificationHistoryEntry[]
}

export interface RectificationHistoryEntry {
  fromStatus: RectificationStatus | null
  toStatus: RectificationStatus
  operator: string
  remark: string
  timestamp: number
}

export type AlertType =
  | 'price_tag_missing'
  | 'theme_mismatch'
  | 'no_responsible'
  | 'promo_tag_missing'
  | 'shelf_arrangement_wrong'
  | 'remark_pending'

export interface StoreArea {
  id: string
  name: string
  description?: string
  createdAt: number
}

export interface DisplayTheme {
  id: string
  name: string
  areaId: string
  validFrom?: string
  validTo?: string
  description?: string
  createdAt: number
}

export interface CheckItem {
  id: string
  name: string
  themeId: string
  required: boolean
  description?: string
  createdAt: number
}

export interface ChecklistItem {
  id: string
  areaId: string
  themeId: string
  checkItemId?: string
  title: string
  expectedPrice?: string
  hasPromoTag?: boolean
  responsible?: string
  displayLocation?: string
  status: AuditStatus | null
  notes: string
  rectificationRemark: string
  missingExplanation: string
  createdAt: number
  updatedAt: number
  verifiedBy?: string
  verifiedAt?: number
}

export interface AlertRecord {
  id: string
  itemId: string
  type: AlertType
  message: string
  createdAt: number
  acknowledged: boolean
}

export interface FilterState {
  areaIds: string[]
  themeIds: string[]
  responsible: string[]
  statuses: AuditStatus[]
  alertTypes: AlertType[]
  searchText: string
}

export interface ColumnConfig {
  area: boolean
  theme: boolean
  checkItem: boolean
  expectedPrice: boolean
  hasPromoTag: boolean
  responsible: boolean
  status: boolean
  updatedAt: boolean
  alerts: boolean
}

export interface UiState {
  sidebarOpen: boolean
  selectedItemId: string | null
  highlightedItemId: string | null
  alertPanelOpen: boolean
  columnSettingsOpen: boolean
  adminPanelOpen: boolean
  importModalOpen: boolean
  currentAdminTab: 'areas' | 'themes' | 'checkItems'
  rectificationPanelOpen: boolean
  rectificationFilterStatus: RectificationStatus | 'all'
  selectedRectificationId: string | null
  rectificationFormOpen: boolean
  rectificationFormItemId: string | null
}

export interface AppState {
  currentRole: UserRole
  currentUser: string
  areas: StoreArea[]
  themes: DisplayTheme[]
  checkItems: CheckItem[]
  checklist: ChecklistItem[]
  alerts: AlertRecord[]
  rectifications: RectificationTask[]
  filters: FilterState
  columns: ColumnConfig
  ui: UiState
  lastSavedAt: number
}

export const STATUS_LABELS: Record<AuditStatus, string> = {
  normal: '正常',
  need_supply: '需补充',
  need_review: '需复核',
  pending: '暂缓处理'
}

export const STATUS_COLORS: Record<AuditStatus, string> = {
  normal: '#10b981',
  need_supply: '#f59e0b',
  need_review: '#ef4444',
  pending: '#6b7280'
}

export const ALERT_LABELS: Record<AlertType, string> = {
  price_tag_missing: '价格牌缺失',
  theme_mismatch: '主题不匹配',
  no_responsible: '责任人空缺',
  promo_tag_missing: '促销标记缺失',
  shelf_arrangement_wrong: '陈列位置错误',
  remark_pending: '有整改待处理'
}

export const ALERT_COLORS: Record<AlertType, string> = {
  price_tag_missing: '#ef4444',
  theme_mismatch: '#f59e0b',
  no_responsible: '#8b5cf6',
  promo_tag_missing: '#f97316',
  shelf_arrangement_wrong: '#0ea5e9',
  remark_pending: '#ec4899'
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: '管理员',
  operator: '运营人员',
  auditor: '审计员'
}

export const DEFAULT_COLUMNS: ColumnConfig = {
  area: true,
  theme: true,
  checkItem: true,
  expectedPrice: true,
  hasPromoTag: true,
  responsible: true,
  status: true,
  updatedAt: true,
  alerts: true
}

export const RECTIFICATION_STATUS_LABELS: Record<RectificationStatus, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  closed: '已关闭'
}

export const RECTIFICATION_STATUS_COLORS: Record<RectificationStatus, string> = {
  pending: '#f59e0b',
  in_progress: '#3b82f6',
  completed: '#10b981',
  closed: '#6b7280'
}

export const DEFAULT_FILTERS: FilterState = {
  areaIds: [],
  themeIds: [],
  responsible: [],
  statuses: [],
  alertTypes: [],
  searchText: ''
}
