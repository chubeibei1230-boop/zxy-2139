import type {
  AppState,
  StoreArea,
  DisplayTheme,
  CheckItem,
  ChecklistItem,
  AlertRecord,
  AlertType,
  AuditStatus,
  FilterState,
  UserRole,
  RectificationTask,
  RectificationStatus,
  RectificationHistoryEntry
} from './types'
import { DEFAULT_COLUMNS, DEFAULT_FILTERS } from './types'

const STORAGE_KEY = 'store_display_audit_state_v1'

type Listener = (state: AppState) => void

const listeners: Set<Listener> = new Set()

let state: AppState | null = null

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function generateSampleData(): {
  areas: StoreArea[]
  themes: DisplayTheme[]
  checkItems: CheckItem[]
  checklist: ChecklistItem[]
} {
  const areas: StoreArea[] = [
    { id: 'area_001', name: '入口陈列区', description: '门店入口处的主题陈列', createdAt: Date.now() - 86400000 * 30 },
    { id: 'area_002', name: '饮料冷柜区', description: '冷藏饮料区域', createdAt: Date.now() - 86400000 * 30 },
    { id: 'area_003', name: '零食货架A', description: '主通道零食货架', createdAt: Date.now() - 86400000 * 30 },
    { id: 'area_004', name: '促销端头', description: '货架两端促销陈列', createdAt: Date.now() - 86400000 * 30 },
    { id: 'area_005', name: '收银台周边', description: '收银台附近陈列', createdAt: Date.now() - 86400000 * 30 }
  ]

  const themes: DisplayTheme[] = [
    { id: 'theme_001', name: '夏季冰饮主题', areaId: 'area_002', validFrom: '2026-06-01', validTo: '2026-08-31', description: '夏日清凉饮料推广', createdAt: Date.now() - 86400000 * 20 },
    { id: 'theme_002', name: '端午礼盒主题', areaId: 'area_001', validFrom: '2026-06-01', validTo: '2026-06-30', description: '端午节粽子礼盒', createdAt: Date.now() - 86400000 * 15 },
    { id: 'theme_003', name: '零食满减促销', areaId: 'area_003', validFrom: '2026-06-05', validTo: '2026-06-20', description: '零食满30减5', createdAt: Date.now() - 86400000 * 10 },
    { id: 'theme_004', name: '收银台小食', areaId: 'area_005', description: '收银台陈列小零食', createdAt: Date.now() - 86400000 * 25 }
  ]

  const checkItems: CheckItem[] = [
    { id: 'ci_001', name: '可乐系列330ml', themeId: 'theme_001', required: true, description: '可口可乐、零度可乐、健怡可乐', createdAt: Date.now() - 86400000 * 20 },
    { id: 'ci_002', name: '雪碧系列500ml', themeId: 'theme_001', required: true, createdAt: Date.now() - 86400000 * 20 },
    { id: 'ci_003', name: '农夫山泉系列', themeId: 'theme_001', required: true, createdAt: Date.now() - 86400000 * 20 },
    { id: 'ci_004', name: '粽子礼盒陈列', themeId: 'theme_002', required: true, description: '五芳斋、真真老老', createdAt: Date.now() - 86400000 * 15 },
    { id: 'ci_005', name: '端午装饰布置', themeId: 'theme_002', required: false, createdAt: Date.now() - 86400000 * 15 },
    { id: 'ci_006', name: '薯片类陈列', themeId: 'theme_003', required: true, description: '乐事、可比克', createdAt: Date.now() - 86400000 * 10 },
    { id: 'ci_007', name: '饼干类陈列', themeId: 'theme_003', required: true, createdAt: Date.now() - 86400000 * 10 },
    { id: 'ci_008', name: '口香糖小货架', themeId: 'theme_004', required: true, createdAt: Date.now() - 86400000 * 25 },
    { id: 'ci_009', name: '巧克力陈列', themeId: 'theme_004', required: false, createdAt: Date.now() - 86400000 * 25 }
  ]

  const baseTime = Date.now() - 86400000 * 3
  const statuses: (AuditStatus | null)[] = ['normal', 'need_supply', 'need_review', 'pending', null, 'normal', 'normal']
  const responsibles = ['张小明', '李芳', '王强', '', '赵敏', '']
  const checklist: ChecklistItem[] = []

  const itemConfigs = [
    { areaId: 'area_001', themeId: 'theme_002', checkItemId: 'ci_004', title: '五芳斋粽子礼盒（肉粽）', expectedPrice: '¥89', hasPromoTag: true, displayLocation: '入口主堆头' },
    { areaId: 'area_001', themeId: 'theme_002', checkItemId: 'ci_004', title: '真真老老粽子礼盒（甜粽）', expectedPrice: '¥78', hasPromoTag: true, displayLocation: '入口主堆头' },
    { areaId: 'area_001', themeId: 'theme_002', checkItemId: 'ci_005', title: '端午主题装饰（挂饰+海报）', expectedPrice: '-', hasPromoTag: false, displayLocation: '入口上方' },
    { areaId: 'area_002', themeId: 'theme_001', checkItemId: 'ci_001', title: '可口可乐 330ml×6罐', expectedPrice: '¥15.9', hasPromoTag: true, displayLocation: '冷柜1层左' },
    { areaId: 'area_002', themeId: 'theme_001', checkItemId: 'ci_001', title: '零度可乐 330ml×6罐', expectedPrice: '¥15.9', hasPromoTag: true, displayLocation: '冷柜1层中' },
    { areaId: 'area_002', themeId: 'theme_001', checkItemId: 'ci_002', title: '雪碧 500ml×24瓶', expectedPrice: '¥48', hasPromoTag: false, displayLocation: '冷柜2层' },
    { areaId: 'area_002', themeId: 'theme_001', checkItemId: 'ci_003', title: '农夫山泉 550ml×24瓶', expectedPrice: '¥28', hasPromoTag: true, displayLocation: '冷柜3层' },
    { areaId: 'area_003', themeId: 'theme_003', checkItemId: 'ci_006', title: '乐事薯片 原味70g', expectedPrice: '¥6.5', hasPromoTag: true, displayLocation: '零食A架2层' },
    { areaId: 'area_003', themeId: 'theme_003', checkItemId: 'ci_006', title: '乐事薯片 黄瓜味70g', expectedPrice: '¥6.5', hasPromoTag: true, displayLocation: '零食A架2层' },
    { areaId: 'area_003', themeId: 'theme_003', checkItemId: 'ci_007', title: '奥利奥饼干 原味97g', expectedPrice: '¥8.9', hasPromoTag: false, displayLocation: '零食A架3层' },
    { areaId: 'area_003', themeId: 'theme_003', checkItemId: 'ci_007', title: '趣多多饼干 巧克力味95g', expectedPrice: '¥8.9', hasPromoTag: true, displayLocation: '零食A架3层' },
    { areaId: 'area_005', themeId: 'theme_004', checkItemId: 'ci_008', title: '绿箭口香糖 5片装', expectedPrice: '¥2.5', hasPromoTag: false, displayLocation: '收银台小架1' },
    { areaId: 'area_005', themeId: 'theme_004', checkItemId: 'ci_008', title: '益达木糖醇 40粒', expectedPrice: '¥9.9', hasPromoTag: true, displayLocation: '收银台小架1' },
    { areaId: 'area_005', themeId: 'theme_004', checkItemId: 'ci_009', title: '德芙巧克力 丝滑牛奶43g', expectedPrice: '¥7.5', hasPromoTag: false, displayLocation: '收银台小架2' }
  ]

  itemConfigs.forEach((cfg, idx) => {
    checklist.push({
      id: uid('item'),
      areaId: cfg.areaId,
      themeId: cfg.themeId,
      checkItemId: cfg.checkItemId,
      title: cfg.title,
      expectedPrice: cfg.expectedPrice,
      hasPromoTag: cfg.hasPromoTag,
      responsible: responsibles[idx % responsibles.length],
      displayLocation: cfg.displayLocation,
      status: statuses[idx % statuses.length],
      notes: '',
      rectificationRemark: idx % 5 === 2 ? '需要联系供应商补货，预计3天内到' : '',
      missingExplanation: idx % 7 === 3 ? '库存不足，已申请调货' : '',
      createdAt: baseTime + idx * 3600000,
      updatedAt: baseTime + idx * 3600000 + 7200000,
      verifiedBy: idx % 2 === 0 ? '系统' : undefined,
      verifiedAt: idx % 2 === 0 ? baseTime + idx * 3600000 + 10800000 : undefined
    })
  })

  return { areas, themes, checkItems, checklist }
}

function createInitialState(): AppState {
  const sample = generateSampleData()
  const alerts = computeAlertsFromChecklist(sample.checklist, sample.areas, sample.themes)
  const rectifications = generateSampleRectifications(sample.checklist)
  return {
    currentRole: 'operator',
    currentUser: '张小明',
    areas: sample.areas,
    themes: sample.themes,
    checkItems: sample.checkItems,
    checklist: sample.checklist,
    alerts,
    rectifications,
    filters: { ...DEFAULT_FILTERS },
    columns: { ...DEFAULT_COLUMNS },
    ui: {
      sidebarOpen: false,
      selectedItemId: null,
      highlightedItemId: null,
      alertPanelOpen: true,
      columnSettingsOpen: false,
      adminPanelOpen: false,
      importModalOpen: false,
      currentAdminTab: 'areas',
      rectificationPanelOpen: false,
      rectificationFilterStatus: 'all',
      selectedRectificationId: null,
      rectificationFormOpen: false,
      rectificationFormItemId: null,
      currentView: 'list',
      summaryModalOpen: false,
      summaryText: ''
    },
    lastSavedAt: Date.now()
  }
}

function computeAlertsFromChecklist(
  checklist: ChecklistItem[],
  areas: StoreArea[],
  themes: DisplayTheme[]
): AlertRecord[] {
  const alerts: AlertRecord[] = []
  const now = Date.now()

  checklist.forEach(item => {
    const theme = themes.find(t => t.id === item.themeId)
    const area = areas.find(a => a.id === item.areaId)
    const areaName = area?.name || '未知区域'

    if (item.status === 'need_supply') {
      alerts.push({
        id: uid('alert'),
        itemId: item.id,
        type: 'price_tag_missing',
        message: `[${areaName}] ${item.title} 需要补充价格牌`,
        createdAt: item.updatedAt,
        acknowledged: false
      })
    }

    if (item.status === 'need_review') {
      alerts.push({
        id: uid('alert'),
        itemId: item.id,
        type: 'theme_mismatch',
        message: `[${areaName}] ${item.title} 陈列与主题${theme?.name || ''}不匹配需复核`,
        createdAt: item.updatedAt,
        acknowledged: false
      })
    }

    if (!item.responsible || item.responsible.trim() === '') {
      alerts.push({
        id: uid('alert'),
        itemId: item.id,
        type: 'no_responsible',
        message: `[${areaName}] ${item.title} 未指定责任人`,
        createdAt: item.createdAt,
        acknowledged: false
      })
    }

    if (item.hasPromoTag === false && item.status === 'normal') {
      const themeHasPromo = themes.find(t => t.id === item.themeId)
      if (themeHasPromo) {
        alerts.push({
          id: uid('alert'),
          itemId: item.id,
          type: 'promo_tag_missing',
          message: `[${areaName}] ${item.title} 促销主题但缺少促销标记`,
          createdAt: item.createdAt,
          acknowledged: false
        })
      }
    }

    if (item.rectificationRemark && item.rectificationRemark.trim() !== '' && item.status !== 'normal') {
      alerts.push({
        id: uid('alert'),
        itemId: item.id,
        type: 'remark_pending',
        message: `[${areaName}] ${item.title} 有整改备注待处理`,
        createdAt: item.updatedAt,
        acknowledged: false
      })
    }
  })

  alerts.sort((a, b) => b.createdAt - a.createdAt)
  return alerts
}

function generateSampleRectifications(checklist: ChecklistItem[]): RectificationTask[] {
  const tasks: RectificationTask[] = []
  const now = Date.now()
  const problemItems = checklist.filter(
    i => i.status === 'need_supply' || i.status === 'need_review' || i.status === 'pending'
  )

  problemItems.slice(0, 3).forEach((item, idx) => {
    const statuses: RectificationStatus[] = ['pending', 'in_progress', 'completed']
    const st = statuses[idx % 3]
    const assignee = item.responsible || '张小明'
    const createdAt = now - 86400000 * (3 - idx)
    const history: RectificationHistoryEntry[] = [
      {
        fromStatus: null,
        toStatus: 'pending',
        operator: '系统',
        remark: '从校对结果自动创建整改任务',
        timestamp: createdAt
      }
    ]
    if (st === 'in_progress') {
      history.push({
        fromStatus: 'pending',
        toStatus: 'in_progress',
        operator: assignee,
        remark: '已开始处理',
        timestamp: createdAt + 86400000
      })
    }
    if (st === 'completed') {
      history.push({
        fromStatus: 'pending',
        toStatus: 'in_progress',
        operator: assignee,
        remark: '已开始处理',
        timestamp: createdAt + 86400000
      })
      history.push({
        fromStatus: 'in_progress',
        toStatus: 'completed',
        operator: assignee,
        remark: '整改完成',
        timestamp: createdAt + 86400000 * 2
      })
    }

    tasks.push({
      id: uid('rect'),
      itemId: item.id,
      requirement: item.rectificationRemark || `对"${item.title}"进行整改，确保陈列符合标准`,
      assignee,
      planCompleteAt: now + 86400000 * (7 - idx * 2),
      status: st,
      createdBy: '系统',
      createdAt,
      updatedAt: history[history.length - 1].timestamp,
      history
    })
  })

  return tasks
}

export function loadState(): AppState {
  if (state) return state
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AppState
      state = parsed
      if (!state.filters) state.filters = { ...DEFAULT_FILTERS }
      if (!state.columns) state.columns = { ...DEFAULT_COLUMNS }
      if (!state.rectifications) state.rectifications = []
      if (!state.ui) {
        state.ui = {
          sidebarOpen: false,
          selectedItemId: null,
          highlightedItemId: null,
          alertPanelOpen: true,
          columnSettingsOpen: false,
          adminPanelOpen: false,
          importModalOpen: false,
          currentAdminTab: 'areas',
          rectificationPanelOpen: false,
          rectificationFilterStatus: 'all',
          selectedRectificationId: null,
          rectificationFormOpen: false,
          rectificationFormItemId: null,
          currentView: 'list',
          summaryModalOpen: false,
          summaryText: ''
        }
      }
      if (state.ui.rectificationPanelOpen === undefined) {
        state.ui.rectificationPanelOpen = false
        state.ui.rectificationFilterStatus = 'all'
        state.ui.selectedRectificationId = null
        state.ui.rectificationFormOpen = false
        state.ui.rectificationFormItemId = null
      }
      if (state.ui.currentView === undefined) {
        state.ui.currentView = 'list'
        state.ui.summaryModalOpen = false
        state.ui.summaryText = ''
      }
      return state
    }
  } catch (e) {
    console.warn('Failed to load state from localStorage, using initial data', e)
  }
  state = createInitialState()
  saveState()
  return state
}

export function saveState(): void {
  if (!state) return
  state.lastSavedAt = Date.now()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state to localStorage', e)
  }
  notifyListeners()
}

function notifyListeners(): void {
  if (!state) return
  const current = state as AppState
  listeners.forEach(fn => {
    try { fn(current) } catch (e) { console.error(e) }
  })
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  if (state) listener(state as AppState)
  return () => listeners.delete(listener)
}

function setState(mutator: (s: AppState) => void): AppState {
  if (!state) loadState()
  if (!state) throw new Error('State not initialized')
  mutator(state)
  saveState()
  return state
}

export function getState(): AppState {
  return loadState()
}

export function setRole(role: UserRole, userName: string): AppState {
  return setState(s => {
    s.currentRole = role
    s.currentUser = userName
  })
}

export function addArea(name: string, description?: string): AppState {
  return setState(s => {
    s.areas.push({ id: uid('area'), name, description, createdAt: Date.now() })
  })
}

export function updateArea(id: string, name: string, description?: string): AppState {
  return setState(s => {
    const a = s.areas.find(x => x.id === id)
    if (a) { a.name = name; a.description = description }
  })
}

export function deleteArea(id: string): AppState {
  return setState(s => {
    s.areas = s.areas.filter(x => x.id !== id)
    s.themes = s.themes.filter(t => t.areaId !== id)
    const keptThemeIds = s.themes.map(t => t.id)
    s.checkItems = s.checkItems.filter(c => keptThemeIds.includes(c.themeId))
    s.checklist = s.checklist.filter(c => c.areaId !== id)
    s.alerts = s.alerts.filter(a => s.checklist.some(c => c.id === a.itemId))
    recomputeFilters(s)
  })
}

export function addTheme(name: string, areaId: string, validFrom?: string, validTo?: string, description?: string): AppState {
  return setState(s => {
    s.themes.push({ id: uid('theme'), name, areaId, validFrom, validTo, description, createdAt: Date.now() })
  })
}

export function updateTheme(id: string, patch: Partial<DisplayTheme>): AppState {
  return setState(s => {
    const t = s.themes.find(x => x.id === id)
    if (t) Object.assign(t, patch)
  })
}

export function deleteTheme(id: string): AppState {
  return setState(s => {
    s.themes = s.themes.filter(x => x.id !== id)
    s.checkItems = s.checkItems.filter(c => c.themeId !== id)
    s.checklist = s.checklist.filter(c => c.themeId !== id)
    s.alerts = s.alerts.filter(a => s.checklist.some(c => c.id === a.itemId))
    recomputeFilters(s)
  })
}

export function addCheckItem(name: string, themeId: string, required: boolean, description?: string): AppState {
  return setState(s => {
    s.checkItems.push({ id: uid('ci'), name, themeId, required, description, createdAt: Date.now() })
  })
}

export function updateCheckItem(id: string, patch: Partial<CheckItem>): AppState {
  return setState(s => {
    const c = s.checkItems.find(x => x.id === id)
    if (c) Object.assign(c, patch)
  })
}

export function deleteCheckItem(id: string): AppState {
  return setState(s => {
    s.checkItems = s.checkItems.filter(x => x.id !== id)
  })
}

export function addChecklistItem(data: Partial<ChecklistItem> & Pick<ChecklistItem, 'areaId' | 'themeId' | 'title'>): AppState {
  return setState(s => {
    const now = Date.now()
    s.checklist.push({
      id: uid('item'),
      areaId: data.areaId,
      themeId: data.themeId,
      checkItemId: data.checkItemId,
      title: data.title,
      expectedPrice: data.expectedPrice,
      hasPromoTag: data.hasPromoTag ?? false,
      responsible: data.responsible,
      displayLocation: data.displayLocation,
      status: data.status ?? null,
      notes: data.notes ?? '',
      rectificationRemark: data.rectificationRemark ?? '',
      missingExplanation: data.missingExplanation ?? '',
      createdAt: now,
      updatedAt: now,
      verifiedBy: data.verifiedBy,
      verifiedAt: data.verifiedAt
    })
    recomputeAlerts(s)
  })
}

export function updateChecklistItem(id: string, patch: Partial<ChecklistItem>): AppState {
  return setState(s => {
    const item = s.checklist.find(x => x.id === id)
    if (item) {
      Object.assign(item, patch)
      item.updatedAt = Date.now()
      item.verifiedBy = s.currentUser
      item.verifiedAt = Date.now()
    }
    recomputeAlerts(s)
  })
}

export function batchSetStatus(itemIds: string[], status: AuditStatus): AppState {
  return setState(s => {
    const now = Date.now()
    s.checklist.forEach(item => {
      if (itemIds.includes(item.id)) {
        item.status = status
        item.updatedAt = now
        item.verifiedBy = s.currentUser
        item.verifiedAt = now
      }
    })
    recomputeAlerts(s)
  })
}

export function deleteChecklistItem(id: string): AppState {
  return setState(s => {
    s.checklist = s.checklist.filter(x => x.id !== id)
    s.alerts = s.alerts.filter(a => a.itemId !== id)
    if (s.ui.selectedItemId === id) s.ui.selectedItemId = null
    if (s.ui.highlightedItemId === id) s.ui.highlightedItemId = null
  })
}

export function setFilters(filters: Partial<FilterState>): AppState {
  return setState(s => { s.filters = { ...s.filters, ...filters } })
}

export function resetFilters(): AppState {
  return setState(s => { s.filters = { ...DEFAULT_FILTERS } })
}

export function toggleColumn(key: keyof typeof DEFAULT_COLUMNS): AppState {
  return setState(s => { s.columns[key] = !s.columns[key] })
}

export function selectItem(id: string | null): AppState {
  return setState(s => { s.ui.selectedItemId = id; s.ui.sidebarOpen = id !== null })
}

export function highlightItem(id: string | null): AppState {
  return setState(s => { s.ui.highlightedItemId = id })
}

export function setAlertPanelOpen(open: boolean): AppState {
  return setState(s => { s.ui.alertPanelOpen = open })
}

export function setColumnSettingsOpen(open: boolean): AppState {
  return setState(s => { s.ui.columnSettingsOpen = open })
}

export function setAdminPanelOpen(open: boolean): AppState {
  return setState(s => { s.ui.adminPanelOpen = open })
}

export function setAdminTab(tab: 'areas' | 'themes' | 'checkItems'): AppState {
  return setState(s => { s.ui.currentAdminTab = tab })
}

export function setImportModalOpen(open: boolean): AppState {
  return setState(s => { s.ui.importModalOpen = open })
}

export function acknowledgeAlert(id: string): AppState {
  return setState(s => {
    const a = s.alerts.find(x => x.id === id)
    if (a) a.acknowledged = true
  })
}

export function bulkImportChecklist(items: Array<Partial<ChecklistItem> & Pick<ChecklistItem, 'areaId' | 'themeId' | 'title'>>): AppState {
  return setState(s => {
    const now = Date.now()
    items.forEach(data => {
      s.checklist.push({
        id: uid('item'),
        areaId: data.areaId,
        themeId: data.themeId,
        checkItemId: data.checkItemId,
        title: data.title,
        expectedPrice: data.expectedPrice,
        hasPromoTag: data.hasPromoTag ?? false,
        responsible: data.responsible,
        displayLocation: data.displayLocation,
        status: data.status ?? null,
        notes: data.notes ?? '',
        rectificationRemark: data.rectificationRemark ?? '',
        missingExplanation: data.missingExplanation ?? '',
        createdAt: now,
        updatedAt: now,
        verifiedBy: data.verifiedBy,
        verifiedAt: data.verifiedAt
      })
    })
    recomputeAlerts(s)
  })
}

export function locateAlert(alertId: string): AppState {
  return setState(s => {
    const alert = s.alerts.find(a => a.id === alertId)
    if (!alert) return
    const item = s.checklist.find(c => c.id === alert.itemId)
    if (!item) return

    let changed = false
    const tryShow = () => {
      const testState: AppState = JSON.parse(JSON.stringify(s))
      const visible = testState.checklist.filter(i => {
        const f = testState.filters
        if (f.areaIds.length > 0 && !f.areaIds.includes(i.areaId)) return false
        if (f.themeIds.length > 0 && !f.themeIds.includes(i.themeId)) return false
        if (f.responsible.length > 0) {
          const wantNone = f.responsible.includes('__none__')
          if (wantNone) {
            if (i.responsible && i.responsible.trim() !== '') return false
          } else {
            if (!i.responsible) return false
            if (!f.responsible.includes(i.responsible)) return false
          }
        }
        if (f.statuses.length > 0) {
          const wantUnchecked = f.statuses.includes('__unchecked__' as AuditStatus)
          if (wantUnchecked) {
            if (i.status !== null) return false
          } else {
            const wantActual = f.statuses.filter(st => st !== '__unchecked__' as AuditStatus)
            if (wantActual.length > 0) {
              if (!i.status) return false
              if (!wantActual.includes(i.status)) return false
            }
          }
        }
        if (f.alertTypes.length > 0) {
          const itemAlertTypes = new Set(testState.alerts.filter(a => a.itemId === i.id).map(a => a.type))
          const hasMatch = f.alertTypes.some(t => itemAlertTypes.has(t))
          if (!hasMatch) return false
        }
        if (f.searchText) {
          const q = f.searchText.toLowerCase()
          if (!i.title.toLowerCase().includes(q) &&
              !(i.displayLocation || '').toLowerCase().includes(q) &&
              !i.rectificationRemark.toLowerCase().includes(q) &&
              !i.missingExplanation.toLowerCase().includes(q)) return false
        }
        return true
      })
      return visible.some(v => v.id === item.id)
    }

    // 依次放宽各个冲突的筛选
    if (s.filters.areaIds.length > 0 && !s.filters.areaIds.includes(item.areaId)) {
      s.filters.areaIds = []
      changed = true
    }
    if (s.filters.themeIds.length > 0 && !s.filters.themeIds.includes(item.themeId)) {
      s.filters.themeIds = []
      changed = true
    }
    if (s.filters.statuses.length > 0) {
      const wantUnchecked = s.filters.statuses.includes('__unchecked__' as AuditStatus)
      let conflict = false
      if (wantUnchecked && item.status !== null) conflict = true
      if (!wantUnchecked && item.status && !s.filters.statuses.includes(item.status)) conflict = true
      if (conflict) {
        s.filters.statuses = []
        changed = true
      }
    }
    // 问题3: 责任人空缺类告警定位时，必须清掉责任人筛选
    if (alert.type === 'no_responsible' || !item.responsible || item.responsible.trim() === '') {
      if (s.filters.responsible.length > 0 && !s.filters.responsible.includes('__none__')) {
        s.filters.responsible = ['__none__']
        changed = true
      }
    } else if (s.filters.responsible.length > 0) {
      if (s.filters.responsible.includes('__none__')) {
        s.filters.responsible = []
        changed = true
      } else if (item.responsible && !s.filters.responsible.includes(item.responsible)) {
        s.filters.responsible = []
        changed = true
      }
    }
    // 问题4: 告警定位不强制限制告警类型，只清理会导致目标被过滤掉的告警类型筛选
    if (s.filters.alertTypes.length > 0 && !s.filters.alertTypes.includes(alert.type)) {
      s.filters.alertTypes = []
      changed = true
    }
    if (s.filters.searchText !== '') {
      s.filters.searchText = ''
      changed = true
    }
    // 兜底：如果还不可见，清空全部筛选
    if (!tryShow()) {
      s.filters.areaIds = []
      s.filters.themeIds = []
      s.filters.statuses = []
      s.filters.responsible = []
      s.filters.alertTypes = []
      s.filters.searchText = ''
      changed = true
    }

    s.ui.highlightedItemId = item.id
    s.ui.selectedItemId = item.id
    s.ui.sidebarOpen = true
  })
}

export function applyAlertTypeFilter(alertType: AlertType): AppState {
  return setState(s => {
    const hasType = s.filters.alertTypes.includes(alertType)
    if (hasType) {
      s.filters.alertTypes = s.filters.alertTypes.filter(t => t !== alertType)
      return
    }
    // 追加前，先预判加上该告警类型后当前列表是否会有结果
    s.filters.alertTypes = [...s.filters.alertTypes, alertType]
    const visibleAfter = getFilteredChecklistInternal(s)
    if (visibleAfter.length === 0) {
      // 没有结果：清理冲突的区域/主题/状态/责任人/搜索词筛选
      const tryRelax = (): ChecklistItem[] => {
        return getFilteredChecklistInternal(s)
      }
      if (tryRelax().length === 0) { s.filters.searchText = '' }
      if (tryRelax().length === 0) { s.filters.responsible = [] }
      if (tryRelax().length === 0) { s.filters.statuses = [] }
      if (tryRelax().length === 0) { s.filters.themeIds = [] }
      if (tryRelax().length === 0) { s.filters.areaIds = [] }
    }
  })
}

function getFilteredChecklistInternal(s: AppState): ChecklistItem[] {
  const { filters } = s
  return s.checklist.filter(item => {
    if (filters.areaIds.length > 0 && !filters.areaIds.includes(item.areaId)) return false
    if (filters.themeIds.length > 0 && !filters.themeIds.includes(item.themeId)) return false
    if (filters.responsible.length > 0) {
      const wantNone = filters.responsible.includes('__none__')
      if (wantNone) {
        if (item.responsible && item.responsible.trim() !== '') return false
      } else {
        if (!item.responsible) return false
        if (!filters.responsible.includes(item.responsible)) return false
      }
    }
    if (filters.statuses.length > 0) {
      const wantUnchecked = filters.statuses.includes('__unchecked__' as AuditStatus)
      if (wantUnchecked) {
        if (item.status !== null) return false
      } else {
        const wantActual = filters.statuses.filter(st => st !== '__unchecked__' as AuditStatus)
        if (wantActual.length > 0) {
          if (!item.status) return false
          if (!wantActual.includes(item.status)) return false
        }
      }
    }
    if (filters.alertTypes.length > 0) {
      const itemAlertTypes = new Set(s.alerts.filter(a => a.itemId === item.id).map(a => a.type))
      const hasMatch = filters.alertTypes.some(t => itemAlertTypes.has(t))
      if (!hasMatch) return false
    }
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase()
      if (!item.title.toLowerCase().includes(q) &&
          !(item.displayLocation || '').toLowerCase().includes(q) &&
          !item.rectificationRemark.toLowerCase().includes(q) &&
          !item.missingExplanation.toLowerCase().includes(q)) return false
    }
    return true
  })
}

export function getVisibleAlerts(): AlertRecord[] {
  const s = loadState()
  const visibleItemIds = new Set(getFilteredChecklistInternal(s).map(i => i.id))
  return s.alerts.filter(a => visibleItemIds.has(a.itemId))
}

function recomputeFilters(s: AppState): void {
  const validAreaIds = new Set(s.areas.map(a => a.id))
  const validThemeIds = new Set(s.themes.map(t => t.id))
  s.filters.areaIds = s.filters.areaIds.filter(id => validAreaIds.has(id))
  s.filters.themeIds = s.filters.themeIds.filter(id => validThemeIds.has(id))
}

function recomputeAlerts(s: AppState): void {
  s.alerts = computeAlertsFromChecklist(s.checklist, s.areas, s.themes)
}

export function getAlertsForItem(itemId: string): AlertRecord[] {
  const s = loadState()
  return s.alerts.filter(a => a.itemId === itemId)
}

export function getFilteredChecklist(): ChecklistItem[] {
  const s = loadState()
  const { filters } = s
  return s.checklist.filter(item => {
    if (filters.areaIds.length > 0 && !filters.areaIds.includes(item.areaId)) return false
    if (filters.themeIds.length > 0 && !filters.themeIds.includes(item.themeId)) return false
    if (filters.responsible.length > 0) {
      const wantNone = filters.responsible.includes('__none__')
      if (wantNone) {
        if (item.responsible && item.responsible.trim() !== '') return false
      } else {
        if (!item.responsible) return false
        if (!filters.responsible.includes(item.responsible)) return false
      }
    }
    if (filters.statuses.length > 0) {
      const wantUnchecked = filters.statuses.includes('__unchecked__' as AuditStatus)
      if (wantUnchecked) {
        if (item.status !== null) return false
      } else {
        const wantActual = filters.statuses.filter(st => st !== '__unchecked__' as AuditStatus)
        if (wantActual.length > 0) {
          if (!item.status) return false
          if (!wantActual.includes(item.status)) return false
        }
      }
    }
    if (filters.alertTypes.length > 0) {
      const itemAlertTypes = new Set(s.alerts.filter(a => a.itemId === item.id).map(a => a.type))
      const hasMatch = filters.alertTypes.some(t => itemAlertTypes.has(t))
      if (!hasMatch) return false
    }
    if (filters.searchText) {
      const q = filters.searchText.toLowerCase()
      const inTitle = item.title.toLowerCase().includes(q)
      const inLocation = item.displayLocation?.toLowerCase().includes(q) ?? false
      const inRemark = item.rectificationRemark.toLowerCase().includes(q)
      const inMissing = item.missingExplanation.toLowerCase().includes(q)
      if (!inTitle && !inLocation && !inRemark && !inMissing) return false
    }
    return true
  })
}

export function exportChecklistToCSV(): string {
  const s = loadState()
  const filtered = getFilteredChecklist()
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const themeMap = new Map(s.themes.map(t => [t.id, t.name]))
  const ciMap = new Map(s.checkItems.map(c => [c.id, c.name]))

  const headers = ['标题', '区域', '陈列主题', '检查项', '期望价格', '促销标记', '责任人', '陈列位置', '校对状态', '备注', '整改备注', '缺失说明', '最后更新', '整改任务状态', '整改要求', '整改责任人', '整改计划完成时间']
  const statusLabels: Record<string, string> = {
    normal: '正常', need_supply: '需补充', need_review: '需复核', pending: '暂缓处理'
  }
  const rectStatusLabels: Record<string, string> = {
    pending: '待处理', in_progress: '处理中', completed: '已完成', closed: '已关闭'
  }

  const rows = filtered.map(item => {
    const rectTasks = s.rectifications.filter(t => t.itemId === item.id)
    const activeRect = rectTasks.find(t => t.status !== 'closed') || rectTasks[rectTasks.length - 1]
    return [
      item.title,
      areaMap.get(item.areaId) || '',
      themeMap.get(item.themeId) || '',
      item.checkItemId ? (ciMap.get(item.checkItemId) || '') : '',
      item.expectedPrice || '',
      item.hasPromoTag ? '有' : '无',
      item.responsible || '',
      item.displayLocation || '',
      item.status ? statusLabels[item.status] : '未校对',
      item.notes,
      item.rectificationRemark,
      item.missingExplanation,
      new Date(item.updatedAt).toLocaleString('zh-CN'),
      activeRect ? rectStatusLabels[activeRect.status] : '',
      activeRect ? activeRect.requirement : '',
      activeRect ? activeRect.assignee : '',
      activeRect && activeRect.planCompleteAt ? new Date(activeRect.planCompleteAt).toLocaleDateString('zh-CN') : ''
    ]
  })

  const csvLines = [headers, ...rows].map(row =>
    row.map(cell => {
      const str = String(cell).replace(/"/g, '""')
      return /[",\n]/.test(str) ? `"${str}"` : str
    }).join(',')
  )
  return '\uFEFF' + csvLines.join('\n')
}

export function clearAllData(): void {
  localStorage.removeItem(STORAGE_KEY)
  state = null
}

export function addRectificationTask(
  itemId: string,
  requirement: string,
  assignee: string,
  planCompleteAt: number | null
): AppState {
  return setState(s => {
    const now = Date.now()
    const task: RectificationTask = {
      id: uid('rect'),
      itemId,
      requirement,
      assignee,
      planCompleteAt,
      status: 'pending',
      createdBy: s.currentUser,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          fromStatus: null,
          toStatus: 'pending',
          operator: s.currentUser,
          remark: '创建整改任务',
          timestamp: now
        }
      ]
    }
    s.rectifications.push(task)
  })
}

export function updateRectificationStatus(
  id: string,
  newStatus: RectificationStatus,
  remark: string
): AppState {
  return setState(s => {
    const task = s.rectifications.find(t => t.id === id)
    if (!task) return
    if (task.status === newStatus) return

    const validTransitions: Record<RectificationStatus, RectificationStatus[]> = {
      pending: ['in_progress', 'closed'],
      in_progress: ['completed', 'closed'],
      completed: ['closed'],
      closed: []
    }
    if (!validTransitions[task.status].includes(newStatus)) return

    const now = Date.now()
    task.history.push({
      fromStatus: task.status,
      toStatus: newStatus,
      operator: s.currentUser,
      remark,
      timestamp: now
    })
    task.status = newStatus
    task.updatedAt = now

    if (newStatus === 'closed') {
      task.closedBy = s.currentUser
      task.closedAt = now
    }

    if (newStatus === 'completed') {
      const item = s.checklist.find(c => c.id === task.itemId)
      if (item && item.status !== 'normal') {
        item.status = 'normal'
        item.updatedAt = now
        item.verifiedBy = s.currentUser
        item.verifiedAt = now
      }
      recomputeAlerts(s)
    }
  })
}

export function getRectificationsForItem(itemId: string): RectificationTask[] {
  const s = loadState()
  return s.rectifications.filter(t => t.itemId === itemId)
}

export function getFilteredRectifications(status: RectificationStatus | 'all'): RectificationTask[] {
  const s = loadState()
  if (status === 'all') return s.rectifications
  return s.rectifications.filter(t => t.status === status)
}

export function setRectificationPanelOpen(open: boolean): AppState {
  return setState(s => { s.ui.rectificationPanelOpen = open })
}

export function setRectificationFilterStatus(status: RectificationStatus | 'all'): AppState {
  return setState(s => { s.ui.rectificationFilterStatus = status })
}

export function selectRectification(id: string | null): AppState {
  return setState(s => { s.ui.selectedRectificationId = id })
}

export function setRectificationFormOpen(open: boolean, itemId?: string | null): AppState {
  return setState(s => {
    s.ui.rectificationFormOpen = open
    s.ui.rectificationFormItemId = itemId ?? null
  })
}

export function getActiveRectificationCount(): number {
  const s = loadState()
  return s.rectifications.filter(t => t.status === 'pending' || t.status === 'in_progress').length
}

export function locateRectificationFromAlert(alertId: string): AppState {
  return setState(s => {
    const alert = s.alerts.find(a => a.id === alertId)
    if (!alert) return
    const task = s.rectifications.find(t => t.itemId === alert.itemId && t.status !== 'closed')
    if (!task) {
      s.ui.rectificationFormItemId = alert.itemId
      s.ui.rectificationFormOpen = true
      s.ui.rectificationPanelOpen = true
      return
    }
    s.ui.rectificationPanelOpen = true
    s.ui.selectedRectificationId = task.id
  })
}

export function setCurrentView(view: 'list' | 'dashboard'): AppState {
  return setState(s => { s.ui.currentView = view })
}

export function setSummaryModalOpen(open: boolean): AppState {
  return setState(s => { s.ui.summaryModalOpen = open })
}

export function generateDashboardStats(): {
  totalItems: number
  checkedCount: number
  uncheckedCount: number
  normalCount: number
  needSupplyCount: number
  needReviewCount: number
  pendingCount: number
  checkProgress: number
  totalAlerts: number
  alertTypeDistribution: Record<string, number>
  responsibleIssueRanking: Array<{ name: string; issueCount: number; totalCount: number }>
  rectificationStatusDistribution: Record<string, number>
  overdueRectificationCount: number
  totalRectifications: number
} {
  const s = loadState()
  const filtered = getFilteredChecklist()
  const visibleItemIds = new Set(filtered.map(i => i.id))
  const visibleAlerts = s.alerts.filter(a => visibleItemIds.has(a.itemId))
  const visibleRectifications = s.rectifications.filter(r => visibleItemIds.has(r.itemId))

  const totalItems = filtered.length
  const checkedCount = filtered.filter(i => i.status !== null).length
  const uncheckedCount = totalItems - checkedCount
  const normalCount = filtered.filter(i => i.status === 'normal').length
  const needSupplyCount = filtered.filter(i => i.status === 'need_supply').length
  const needReviewCount = filtered.filter(i => i.status === 'need_review').length
  const pendingCount = filtered.filter(i => i.status === 'pending').length
  const checkProgress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0

  const alertTypeDistribution: Record<string, number> = {
    price_tag_missing: 0,
    theme_mismatch: 0,
    no_responsible: 0,
    promo_tag_missing: 0,
    shelf_arrangement_wrong: 0,
    remark_pending: 0
  }
  visibleAlerts.forEach(a => {
    if (alertTypeDistribution[a.type] !== undefined) {
      alertTypeDistribution[a.type]++
    }
  })

  const responsibleMap = new Map<string, { issueCount: number; totalCount: number }>()
  filtered.forEach(item => {
    const name = item.responsible || '未指定'
    if (!responsibleMap.has(name)) {
      responsibleMap.set(name, { issueCount: 0, totalCount: 0 })
    }
    const entry = responsibleMap.get(name)!
    entry.totalCount++
    if (item.status === 'need_supply' || item.status === 'need_review' || item.status === 'pending') {
      entry.issueCount++
    }
  })
  const responsibleIssueRanking = Array.from(responsibleMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.issueCount - a.issueCount || b.totalCount - a.totalCount)

  const rectificationStatusDistribution: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    closed: 0
  }
  visibleRectifications.forEach(r => {
    if (rectificationStatusDistribution[r.status] !== undefined) {
      rectificationStatusDistribution[r.status]++
    }
  })

  const now = Date.now()
  const overdueRectificationCount = visibleRectifications.filter(
    r => r.planCompleteAt && r.planCompleteAt < now && r.status !== 'completed' && r.status !== 'closed'
  ).length

  return {
    totalItems,
    checkedCount,
    uncheckedCount,
    normalCount,
    needSupplyCount,
    needReviewCount,
    pendingCount,
    checkProgress,
    totalAlerts: visibleAlerts.length,
    alertTypeDistribution,
    responsibleIssueRanking,
    rectificationStatusDistribution,
    overdueRectificationCount,
    totalRectifications: visibleRectifications.length
  }
}

export function generateReviewSummary(): string {
  const s = loadState()
  const stats = generateDashboardStats()
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const themeMap = new Map(s.themes.map(t => [t.id, t.name]))

  const now = new Date()
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

  const lines: string[] = []
  lines.push(`【门店陈列核对复盘摘要 - ${dateStr}】`)
  lines.push('')

  lines.push('一、完成概况')
  lines.push(`  · 清单总数：${stats.totalItems} 项`)
  lines.push(`  · 已校对：${stats.checkedCount} 项（${stats.checkProgress}%）`)
  lines.push(`  · 未校对：${stats.uncheckedCount} 项`)
  lines.push(`  · 正常项：${stats.normalCount} 项`)
  lines.push(`  · 问题项：${stats.needSupplyCount + stats.needReviewCount + stats.pendingCount} 项`)
  lines.push('')

  lines.push('二、问题分布')
  lines.push(`  · 需补充：${stats.needSupplyCount} 项`)
  lines.push(`  · 需复核：${stats.needReviewCount} 项`)
  lines.push(`  · 暂缓处理：${stats.pendingCount} 项`)
  lines.push('')

  lines.push('三、告警类型分布')
  const alertTypes = Object.entries(stats.alertTypeDistribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
  const alertLabels: Record<string, string> = {
    price_tag_missing: '价格牌缺失',
    theme_mismatch: '主题不匹配',
    no_responsible: '责任人空缺',
    promo_tag_missing: '促销标记缺失',
    shelf_arrangement_wrong: '陈列位置错误',
    remark_pending: '有整改待处理'
  }
  if (alertTypes.length > 0) {
    alertTypes.forEach(([type, count]) => {
      lines.push(`  · ${alertLabels[type] || type}：${count} 条`)
    })
  } else {
    lines.push('  · 暂无告警')
  }
  lines.push('')

  lines.push('四、待跟进责任人（问题项排行）')
  const topResponsible = stats.responsibleIssueRanking.filter(r => r.issueCount > 0).slice(0, 5)
  if (topResponsible.length > 0) {
    topResponsible.forEach((r, idx) => {
      lines.push(`  ${idx + 1}. ${r.name}：${r.issueCount} 项问题 / 共 ${r.totalCount} 项`)
    })
  } else {
    lines.push('  · 暂无问题项责任人')
  }
  lines.push('')

  lines.push('五、整改任务状态')
  lines.push(`  · 整改总数：${stats.totalRectifications} 项`)
  lines.push(`  · 待处理：${stats.rectificationStatusDistribution.pending} 项`)
  lines.push(`  · 处理中：${stats.rectificationStatusDistribution.in_progress} 项`)
  lines.push(`  · 已完成：${stats.rectificationStatusDistribution.completed} 项`)
  lines.push(`  · 已关闭：${stats.rectificationStatusDistribution.closed} 项`)
  if (stats.overdueRectificationCount > 0) {
    lines.push(`  · ⚠️ 已逾期：${stats.overdueRectificationCount} 项`)
  }
  lines.push('')

  lines.push('六、关键风险提示')
  const risks: string[] = []
  if (stats.overdueRectificationCount > 0) {
    risks.push(`${stats.overdueRectificationCount} 项整改任务已逾期，需重点跟进`)
  }
  if (stats.needReviewCount > 0) {
    risks.push(`${stats.needReviewCount} 项需复核，建议尽快安排二次核对`)
  }
  if (stats.alertTypeDistribution.no_responsible > 0) {
    risks.push(`${stats.alertTypeDistribution.no_responsible} 项未指定责任人，存在管理盲区`)
  }
  if (stats.checkProgress < 100 && stats.totalItems > 0) {
    risks.push(`校对进度 ${stats.checkProgress}%，尚有 ${stats.uncheckedCount} 项未完成`)
  }
  if (risks.length > 0) {
    risks.forEach((risk, idx) => {
      lines.push(`  ${idx + 1}. ${risk}`)
    })
  } else {
    lines.push('  · 暂无明显风险，整体执行良好')
  }
  lines.push('')

  lines.push('—— 以上为系统自动生成，供日报参考 ——')

  return lines.join('\n')
}

export function drillDownByStatus(status: AuditStatus | 'unchecked'): AppState {
  return setState(s => {
    if (status === 'unchecked') {
      s.filters.statuses = ['__unchecked__' as AuditStatus]
    } else {
      s.filters.statuses = [status]
    }
    s.filters.areaIds = []
    s.filters.themeIds = []
    s.filters.responsible = []
    s.filters.alertTypes = []
    s.filters.searchText = ''
    s.ui.currentView = 'list'
    s.ui.highlightedItemId = null
  })
}

export function drillDownByAlertType(alertType: AlertType): AppState {
  return setState(s => {
    s.filters.alertTypes = [alertType]
    s.filters.areaIds = []
    s.filters.themeIds = []
    s.filters.responsible = []
    s.filters.statuses = []
    s.filters.searchText = ''
    s.ui.currentView = 'list'
    s.ui.highlightedItemId = null
  })
}

export function drillDownByResponsible(responsible: string): AppState {
  return setState(s => {
    if (responsible === '未指定') {
      s.filters.responsible = ['__none__']
    } else {
      s.filters.responsible = [responsible]
    }
    s.filters.areaIds = []
    s.filters.themeIds = []
    s.filters.statuses = []
    s.filters.alertTypes = []
    s.filters.searchText = ''
    s.ui.currentView = 'list'
    s.ui.highlightedItemId = null
  })
}

export function drillDownByRectificationStatus(status: RectificationStatus | 'overdue'): AppState {
  return setState(s => {
    s.ui.rectificationPanelOpen = true
    if (status === 'overdue') {
      s.ui.rectificationFilterStatus = 'pending'
    } else {
      s.ui.rectificationFilterStatus = status
    }
    s.ui.currentView = 'list'
  })
}
