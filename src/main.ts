import './styles.css'
import type {
  AppState,
  ChecklistItem,
  AuditStatus,
  AlertType,
  AlertRecord,
  UserRole,
  StoreArea,
  DisplayTheme,
  CheckItem,
  ColumnConfig,
  RectificationTask,
  RectificationStatus
} from './types'
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ALERT_LABELS,
  ALERT_COLORS,
  ROLE_LABELS,
  DEFAULT_COLUMNS,
  RECTIFICATION_STATUS_LABELS,
  RECTIFICATION_STATUS_COLORS
} from './types'
import * as store from './store'

type ColumnKey = keyof ColumnConfig

const COLUMN_LABELS: Record<ColumnKey, string> = {
  area: '门店区域',
  theme: '陈列主题',
  checkItem: '检查项',
  expectedPrice: '期望价格',
  hasPromoTag: '促销标记',
  responsible: '责任人',
  status: '校对状态',
  updatedAt: '最后更新',
  alerts: '告警'
}

const COLUMN_ORDER: ColumnKey[] = [
  'area', 'theme', 'checkItem', 'expectedPrice', 'hasPromoTag',
  'responsible', 'status', 'updatedAt', 'alerts'
]

let selectedCheckboxes = new Set<string>()
let alertPointer = 0
let editingDraft: Record<string, Partial<ChecklistItem>> = {}
let columnPanelEl: HTMLElement | null = null

function esc(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function canEdit(role: UserRole): boolean {
  return role === 'admin' || role === 'operator'
}

function canEditConfig(role: UserRole): boolean {
  return role === 'admin'
}

function render(): void {
  const s = store.getState()
  const app = document.getElementById('app')
  if (!app) return

  const readOnly = !canEdit(s.currentRole)
  const configReadOnly = !canEditConfig(s.currentRole)

  app.innerHTML = `
    <div class="app">
      ${renderToolbar(s, configReadOnly)}
      ${renderFilterBar(s)}
      <div class="main-content">
        ${s.ui.currentView === 'dashboard' ? renderDashboard(s) : renderListArea(s, readOnly)}
        ${renderAlertPanel(s)}
      </div>
      ${renderDetailSidebar(s, readOnly)}
      ${renderRectificationPanel(s)}
      ${renderRectificationFormModal(s)}
      ${renderAdminModal(s, configReadOnly)}
      ${renderImportModal(s, readOnly)}
      ${renderColumnPopover(s)}
      ${renderSummaryModal(s)}
    </div>
  `

  bindEvents()
  setupKeyboardShortcuts()
}

function getActiveFilterCount(s: AppState): number {
  const f = s.filters
  return f.areaIds.length + f.themeIds.length + f.responsible.length +
    f.statuses.length + f.alertTypes.length + (f.searchText ? 1 : 0)
}

function renderToolbar(s: AppState, configReadOnly: boolean): string {
  const activeFilters = getActiveFilterCount(s)
  const avatarInitial = s.currentUser.charAt(0) || 'U'

  return `
    <div class="toolbar">
      <div class="toolbar-left">
        <div class="logo">店</div>
        <div class="app-title">门店陈列核对系统</div>
      </div>
      <div class="toolbar-divider"></div>
      <div class="toolbar-center">
        <div class="view-switcher">
          <button class="view-switch-btn ${s.ui.currentView === 'list' ? 'active' : ''}" data-view="list">📋 清单</button>
          <button class="view-switch-btn ${s.ui.currentView === 'dashboard' ? 'active' : ''}" data-view="dashboard">📊 看板</button>
        </div>
        ${s.ui.currentView === 'dashboard' ? `
          <button class="btn btn-primary btn-sm" id="generateSummaryBtn" title="一键生成复盘摘要">
            📝 生成复盘摘要
          </button>
        ` : `
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input type="text" id="searchInput" placeholder="搜索标题、位置、备注…" value="${esc(s.filters.searchText)}" />
          </div>
          <button class="filter-btn ${activeFilters > 0 ? 'active' : ''}" id="toggleFilterBtn">
            <span>⚙ 筛选</span>
            ${activeFilters > 0 ? `<span class="filter-badge">${activeFilters}</span>` : ''}
          </button>
        `}
        <button class="filter-btn ${s.ui.alertPanelOpen ? 'active' : ''}" id="toggleAlertBtn" title="告警面板">
          <span>🔔 告警</span>
          ${s.alerts.length > 0 ? `<span class="filter-badge" style="background:${ALERT_COLORS.price_tag_missing}">${s.alerts.length}</span>` : ''}
        </button>
        <button class="filter-btn ${s.ui.rectificationPanelOpen ? 'active' : ''}" id="toggleRectBtn" title="整改闭环跟踪">
          <span>🔄 整改</span>
          ${store.getActiveRectificationCount() > 0 ? `<span class="filter-badge" style="background:#8b5cf6">${store.getActiveRectificationCount()}</span>` : ''}
        </button>
      </div>
      <div class="toolbar-right">
        ${!configReadOnly ? `
          <button class="btn" id="importBtn">📥 导入</button>
        ` : ''}
        <button class="btn" id="exportBtn">📤 导出</button>
        <button class="btn btn-icon" id="columnBtn" title="列设置">⚙</button>
        ${!configReadOnly ? `
          <button class="btn btn-primary" id="adminBtn">🔧 配置</button>
        ` : ''}
        <div class="role-selector">
          <button class="role-btn ${s.currentRole === 'admin' ? 'active' : ''}" data-role="admin">管理员</button>
          <button class="role-btn ${s.currentRole === 'operator' ? 'active' : ''}" data-role="operator">运营</button>
          <button class="role-btn ${s.currentRole === 'auditor' ? 'active' : ''}" data-role="auditor">审计</button>
        </div>
        <div class="user-avatar" title="${esc(s.currentUser)} (${ROLE_LABELS[s.currentRole]})">${esc(avatarInitial)}</div>
      </div>
    </div>
  `
}

function renderFilterBar(s: AppState): string {
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const themeMap = new Map(s.themes.map(t => [t.id, t.name]))
  const responsibleSet = new Set<string>()
  s.checklist.forEach(c => { if (c.responsible) responsibleSet.add(c.responsible) })
  const responsibles = Array.from(responsibleSet).sort()

  return `
    <div class="filter-bar">
      <div class="filter-group">
        <div class="filter-label">门店区域</div>
        <div class="filter-chips">
          ${s.areas.map(a => `
            <span class="chip ${s.filters.areaIds.includes(a.id) ? 'active' : ''}" data-filter="area" data-value="${esc(a.id)}">${esc(a.name)}</span>
          `).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-label">陈列主题</div>
        <div class="filter-chips">
          ${s.themes.map(t => {
            const areaName = areaMap.get(t.areaId) || ''
            return `<span class="chip ${s.filters.themeIds.includes(t.id) ? 'active' : ''}" data-filter="theme" data-value="${esc(t.id)}" title="${esc(areaName)}">${esc(t.name)}</span>`
          }).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-label">责任人</div>
        <div class="filter-chips">
          <span class="chip ${s.filters.responsible.includes('__none__') ? 'active' : ''}" data-filter="responsible" data-value="__none__">未指定</span>
          ${responsibles.map(r => `
            <span class="chip ${s.filters.responsible.includes(r) ? 'active' : ''}" data-filter="responsible" data-value="${esc(r)}">${esc(r)}</span>
          `).join('')}
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-label">校对状态</div>
        <div class="filter-chips">
          ${(['normal', 'need_supply', 'need_review', 'pending'] as AuditStatus[]).map(st => `
            <span class="chip ${s.filters.statuses.includes(st) ? 'active' : ''}" data-filter="status" data-value="${st}">${STATUS_LABELS[st]}</span>
          `).join('')}
          <span class="chip ${s.filters.statuses.includes('__unchecked__' as AuditStatus) ? 'active' : ''}" data-filter="status" data-value="__unchecked__">未校对</span>
        </div>
      </div>
      <div class="filter-group">
        <div class="filter-label">告警类型</div>
        <div class="filter-chips">
          ${(Object.keys(ALERT_LABELS) as AlertType[]).map(at => `
            <span class="chip ${s.filters.alertTypes.includes(at) ? 'active' : ''}" data-filter="alert" data-value="${at}"
              style="${s.filters.alertTypes.includes(at) ? `background:${ALERT_COLORS[at]};border-color:${ALERT_COLORS[at]}` : ''}">
              ${ALERT_LABELS[at]}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="filter-actions">
        <button class="btn btn-sm" id="resetFilterBtn">重置筛选</button>
      </div>
    </div>
  `
}

function renderListArea(s: AppState, readOnly: boolean): string {
  const filtered = store.getFilteredChecklist()
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const themeMap = new Map(s.themes.map(t => [t.id, t.name]))
  const ciMap = new Map(s.checkItems.map(c => [c.id, c.name]))

  const total = filtered.length
  const done = filtered.filter(i => i.status !== null).length
  const issues = filtered.filter(i => i.status === 'need_supply' || i.status === 'need_review').length
  const activeRectCount = s.rectifications.filter(t => t.status === 'pending' || t.status === 'in_progress').length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const visibleCols = COLUMN_ORDER.filter(col => s.columns[col])

  function renderTableHeader(): string {
    let html = `<th class="checkbox-col"><input type="checkbox" id="selectAllChk" ${selectedCheckboxes.size === total && total > 0 ? 'checked' : ''}/></th>`
    html += `<th style="min-width:240px">陈列标题</th>`
    visibleCols.forEach(col => {
      html += `<th>${COLUMN_LABELS[col]}</th>`
    })
    if (!readOnly) html += `<th style="width:180px">快速操作</th>`
    return html
  }

  function renderRow(item: ChecklistItem): string {
    const isHighlighted = s.ui.highlightedItemId === item.id
    const isSelected = s.ui.selectedItemId === item.id
    const isChecked = selectedCheckboxes.has(item.id)
    const itemAlerts = s.alerts.filter(a => a.itemId === item.id)
    const statusClass = item.status || 'unchecked'
    const statusText = item.status ? STATUS_LABELS[item.status] : '未校对'

    let cells = ''
    const col: Record<ColumnKey, () => string> = {
      area: () => `<td>${esc(areaMap.get(item.areaId) || '-')}</td>`,
      theme: () => `<td>${esc(themeMap.get(item.themeId) || '-')}</td>`,
      checkItem: () => `<td>${esc(item.checkItemId ? (ciMap.get(item.checkItemId) || '-') : '-')}</td>`,
      expectedPrice: () => `<td style="color:var(--danger);font-weight:600">${esc(item.expectedPrice || '-')}</td>`,
      hasPromoTag: () => `<td>${item.hasPromoTag ? '<span class="text-success">✓ 有</span>' : '<span class="text-muted">—</span>'}</td>`,
      responsible: () => `<td>${item.responsible ? `<span style="color:var(--primary);font-weight:500">${esc(item.responsible)}</span>` : '<span class="text-danger">未指定</span>'}</td>`,
      status: () => `<td class="status-col"><span class="status-tag ${statusClass}">${statusText}</span></td>`,
      updatedAt: () => `<td class="text-muted" style="white-space:nowrap">${formatTime(item.updatedAt)}</td>`,
      alerts: () => {
        const rectTasks = s.rectifications.filter(t => t.itemId === item.id && t.status !== 'closed')
        const activeRect = rectTasks[0]
        return `<td><div class="alert-tags">
          ${itemAlerts.slice(0, 3).map(a => `
            <span class="alert-tag" style="background:${ALERT_COLORS[a.type]}" title="${esc(ALERT_LABELS[a.type])}">${ALERT_LABELS[a.type].slice(0, 4)}</span>
          `).join('')}${itemAlerts.length > 3 ? `<span class="alert-tag" style="background:var(--text-muted)">+${itemAlerts.length - 3}</span>` : ''}
          ${activeRect ? `<span class="alert-tag" style="background:${RECTIFICATION_STATUS_COLORS[activeRect.status]};cursor:pointer" data-rect-locate="${activeRect.id}" title="整改: ${RECTIFICATION_STATUS_LABELS[activeRect.status]}">🔄${RECTIFICATION_STATUS_LABELS[activeRect.status].slice(0, 2)}</span>` : ''}
        </div></td>`
      }
    }
    visibleCols.forEach(k => { cells += col[k]() })

    const quickBtns = readOnly ? '' : `
      <td>
        <div class="quick-actions">
          <button class="quick-btn" data-quick="normal" data-id="${item.id}" title="正常 (1)">✓</button>
          <button class="quick-btn" data-quick="need_supply" data-id="${item.id}" title="需补充 (2)">+</button>
          <button class="quick-btn" data-quick="need_review" data-id="${item.id}" title="需复核 (3)">!</button>
          <button class="quick-btn" data-quick="pending" data-id="${item.id}" title="暂缓 (4)">⏸</button>
        </div>
      </td>
    `

    return `
      <tr class="${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}" data-row-id="${item.id}">
        <td class="checkbox-col"><input type="checkbox" class="row-chk" data-id="${item.id}" ${isChecked ? 'checked' : ''}/></td>
        <td>
          <div class="col-title">
            <div>
              <div class="title-main">${esc(item.title)}</div>
              <div class="title-sub">${esc(item.displayLocation || '')}</div>
            </div>
          </div>
        </td>
        ${cells}
        ${quickBtns}
      </tr>
    `
  }

  return `
    <div class="list-container">
      <div class="list-toolbar">
        <div class="stats-info">
          <span class="stats-badge total">共 ${total} 项</span>
          <span class="stats-badge done">已校对 ${done}</span>
          <span class="stats-badge issue">问题 ${issues}</span>
          ${activeRectCount > 0 ? `<span class="stats-badge" style="background:#ede9fe;color:#6d28d9">整改中 ${activeRectCount}</span>` : ''}
          <span class="hotkey-hint">N 下一条告警</span>
          <span class="hotkey-hint">1-4 标记状态</span>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          <div class="progress-text">校对进度 ${progress}%</div>
        </div>
        <div class="batch-actions">
          ${!readOnly && selectedCheckboxes.size > 0 ? `
            <span class="text-muted" style="font-size:12px">已选 ${selectedCheckboxes.size} 项：</span>
            <button class="btn btn-sm btn-success" data-batch="normal">标记正常</button>
            <button class="btn btn-sm btn-warning" data-batch="need_supply">需补充</button>
            <button class="btn btn-sm btn-danger" data-batch="need_review">需复核</button>
            <button class="btn btn-sm" data-batch="pending">暂缓</button>
            <button class="btn btn-sm" id="clearSelectionBtn">取消</button>
          ` : ''}
        </div>
      </div>
      <div class="list-scroll" id="listScroll">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <div>没有符合条件的记录</div>
            <div style="margin-top:6px;font-size:12px">请调整筛选条件或导入新的清单</div>
          </div>
        ` : `
          <table class="checklist-table">
            <thead><tr>${renderTableHeader()}</tr></thead>
            <tbody>
              ${filtered.map(renderRow).join('')}
            </tbody>
          </table>
        `}
      </div>
    </div>
  `
}

function renderAlertPanel(s: AppState): string {
  if (!s.ui.alertPanelOpen) {
    return `<div class="alert-panel closed"></div>`
  }

  // 问题1：告警面板按当前筛选后的列表范围重新计算
  const visibleAlerts = store.getVisibleAlerts()
  const hasFilter = s.filters.areaIds.length + s.filters.themeIds.length +
    s.filters.responsible.length + s.filters.statuses.length +
    s.filters.alertTypes.length + (s.filters.searchText ? 1 : 0) > 0

  const grouped = new Map<AlertType, AlertRecord[]>()
  visibleAlerts.forEach(a => {
    if (!grouped.has(a.type)) grouped.set(a.type, [])
    grouped.get(a.type)!.push(a)
  })

  return `
    <div class="alert-panel" id="alertPanel">
      <div class="alert-panel-header">
        <div class="alert-panel-title">
          🔔 告警记录
          <span class="alert-count-badge">${visibleAlerts.length}</span>
          ${hasFilter && visibleAlerts.length < s.alerts.length
            ? `<span class="text-muted" style="font-size:11px;font-weight:400;margin-left:4px">(总 ${s.alerts.length}，已筛选)</span>`
            : ''}
        </div>
        <button class="close-btn" id="closeAlertBtn" title="关闭">×</button>
      </div>
      <div class="alert-panel-body">
        ${visibleAlerts.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div>当前筛选范围暂无告警</div>
            ${hasFilter ? `<div style="margin-top:6px;font-size:12px">放宽筛选条件可查看更多</div>` : ''}
          </div>
        ` : (Object.keys(ALERT_LABELS) as AlertType[]).map(type => {
          const items = grouped.get(type) || []
          if (items.length === 0) return ''
          const activeInFilter = s.filters.alertTypes.includes(type)
          return `
            <div class="alert-type-group">
              <div class="alert-type-header ${activeInFilter ? 'active' : ''}" data-filter-alert="${type}"
                style="${activeInFilter ? `background:${ALERT_COLORS[type]}22;color:${ALERT_COLORS[type]}` : ''}">
                <span class="alert-type-dot" style="background:${ALERT_COLORS[type]}"></span>
                <span>${ALERT_LABELS[type]}</span>
                <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${items.length}${activeInFilter ? ' ● 已筛选' : ''}</span>
              </div>
              <div class="alert-list">
                ${items.slice(0, 8).map(a => `
                  <div class="alert-item ${a.acknowledged ? 'acknowledged' : ''}" data-alert="${a.id}">
                    <div class="alert-msg">${esc(a.message)}</div>
                    <div class="alert-meta">
                      <span>${formatTime(a.createdAt)}</span>
                      <div style="display:flex;gap:6px;align-items:center">
                        ${s.rectifications.some(t => t.itemId === a.itemId && t.status !== 'closed') ? `<span class="alert-rect-link" data-alert-rect="${a.id}">🔄整改</span>` : ''}
                        <span>${a.acknowledged ? '已查看' : ''}</span>
                      </div>
                    </div>
                  </div>
                `).join('')}
                ${items.length > 8 ? `<div class="text-muted" style="padding:4px 8px;font-size:11px">还有 ${items.length - 8} 条…</div>` : ''}
              </div>
            </div>
          `
        }).join('')}
      </div>
    </div>
  `
}

function renderDetailSidebar(s: AppState, readOnly: boolean): string {
  const item = s.ui.selectedItemId ? s.checklist.find(c => c.id === s.ui.selectedItemId) : null
  const open = s.ui.sidebarOpen && !!item
  if (!item) return `<div class="sidebar-overlay"></div><div class="detail-sidebar"></div>`

  const areaName = s.areas.find(a => a.id === item.areaId)?.name || '-'
  const themeName = s.themes.find(t => t.id === item.themeId)?.name || '-'
  const checkItemName = item.checkItemId ? (s.checkItems.find(c => c.id === item.checkItemId)?.name || '-') : '-'
  const draft = editingDraft[item.id] || {}
  const merged: ChecklistItem = { ...item, ...draft }
  const itemAlerts = s.alerts.filter(a => a.itemId === item.id)
  const statusColor = item.status ? STATUS_COLORS[item.status] : 'var(--text-muted)'

  function renderStatusOption(value: AuditStatus | '__clear__', label: string, color: string): string {
    const isSelected = (value === '__clear__' ? merged.status === null : merged.status === value)
    const showColor = value === '__clear__' ? 'var(--text-muted)' : color
    return `
      <div class="status-option ${isSelected ? 'selected' : ''}" data-status-value="${value}"
        style="color:${showColor};">
        <div class="radio-dot"></div>
        <div class="status-text">${label}</div>
      </div>
    `
  }

  const disabled = readOnly ? 'disabled' : ''

  return `
    <div class="sidebar-overlay ${open ? 'open' : ''}" id="sidebarOverlay"></div>
    <div class="detail-sidebar ${open ? 'open' : ''}" id="detailSidebar">
      <div class="sidebar-header">
        <div class="sidebar-title-wrap">
          <div class="sidebar-title">${esc(item.title)}</div>
          <div class="sidebar-subtitle">
            <span>📍 ${esc(areaName)}</span>
            <span>🎯 ${esc(themeName)}</span>
            <span>🔗 ${esc(checkItemName)}</span>
          </div>
          ${itemAlerts.length > 0 ? `
            <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">
              ${itemAlerts.map(a => `<span class="alert-tag" style="background:${ALERT_COLORS[a.type]}">${ALERT_LABELS[a.type]}</span>`).join('')}
            </div>
          ` : ''}
        </div>
        <button class="close-btn" id="closeSidebarBtn" title="关闭">×</button>
      </div>
      <div class="sidebar-body">
        <div class="form-section">
          <div class="section-title">📝 校对状态</div>
          <div class="status-picker" style="${readOnly ? 'opacity:0.8;pointer-events:none' : ''}">
            ${renderStatusOption('normal', '✓ 正常', STATUS_COLORS.normal)}
            ${renderStatusOption('need_supply', '+ 需补充', STATUS_COLORS.need_supply)}
            ${renderStatusOption('need_review', '! 需复核', STATUS_COLORS.need_review)}
            ${renderStatusOption('pending', '⏸ 暂缓处理', STATUS_COLORS.pending)}
          </div>
          <div style="margin-top:10px;display:flex;justify-content:center;${readOnly ? 'opacity:0.6' : ''}">
            <button class="btn btn-sm" data-status-value="__clear__" ${disabled}>
              清除状态（未校对）
            </button>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">📋 基础信息</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">陈列标题</label>
              <input type="text" class="form-input" data-field="title" value="${esc(merged.title)}" ${disabled}/>
            </div>
            <div class="form-group">
              <label class="form-label">期望价格</label>
              <input type="text" class="form-input" data-field="expectedPrice" value="${esc(merged.expectedPrice || '')}" ${disabled}/>
            </div>
            <div class="form-group">
              <label class="form-label">门店区域</label>
              <select class="form-select" data-field="areaId" ${disabled}>
                ${s.areas.map(a => `<option value="${esc(a.id)}" ${merged.areaId === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">陈列主题</label>
              <select class="form-select" data-field="themeId" ${disabled}>
                ${s.themes.filter(t => t.areaId === merged.areaId).map(t => `<option value="${esc(t.id)}" ${merged.themeId === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">陈列位置</label>
              <input type="text" class="form-input" data-field="displayLocation" value="${esc(merged.displayLocation || '')}" ${disabled}/>
            </div>
            <div class="form-group">
              <label class="form-label">责任人</label>
              <input type="text" class="form-input" data-field="responsible" value="${esc(merged.responsible || '')}" placeholder="输入责任人姓名" ${disabled}/>
            </div>
            <div class="form-group" style="grid-column:1/-1;">
              <label class="checkbox-inline">
                <input type="checkbox" data-field="hasPromoTag" ${merged.hasPromoTag ? 'checked' : ''} ${disabled}/>
                有促销标记
              </label>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">💬 备注说明</div>
          <div class="form-grid">
            <div class="form-group full-width">
              <label class="form-label">一般备注</label>
              <textarea class="form-textarea" data-field="notes" placeholder="其他需要记录的信息…" ${disabled}>${esc(merged.notes)}</textarea>
            </div>
            <div class="form-group full-width">
              <label class="form-label">缺失说明 <span class="hotkey-hint">标记"需补充"时填写</span></label>
              <textarea class="form-textarea" data-field="missingExplanation" placeholder="说明缺失内容、原因、调货进度等…" ${disabled}>${esc(merged.missingExplanation)}</textarea>
            </div>
            <div class="form-group full-width">
              <label class="form-label">整改备注 <span class="hotkey-hint">需复核或后续处理</span></label>
              <textarea class="form-textarea" data-field="rectificationRemark" placeholder="整改措施、责任人、完成时间等…" ${disabled}>${esc(merged.rectificationRemark)}</textarea>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">ℹ️ 校对记录</div>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">创建时间</label>
              <input type="text" class="form-input" value="${new Date(item.createdAt).toLocaleString('zh-CN')}" disabled/>
            </div>
            <div class="form-group">
              <label class="form-label">最后更新</label>
              <input type="text" class="form-input" value="${new Date(item.updatedAt).toLocaleString('zh-CN')}" disabled/>
            </div>
            <div class="form-group">
              <label class="form-label">最后校对人</label>
              <input type="text" class="form-input" value="${esc(item.verifiedBy || '-')}" disabled/>
            </div>
            <div class="form-group">
              <label class="form-label">校对时间</label>
              <input type="text" class="form-input" value="${item.verifiedAt ? new Date(item.verifiedAt).toLocaleString('zh-CN') : '-'}" disabled/>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="section-title">🔄 整改任务</div>
          ${(() => {
            const rectTasks = store.getRectificationsForItem(item.id)
            const activeRects = rectTasks.filter(t => t.status !== 'closed')
            const closedRects = rectTasks.filter(t => t.status === 'closed')
            const canCreateRect = canEdit(s.currentRole) && (item.status === 'need_supply' || item.status === 'need_review' || item.status === 'pending')
            return `
              ${canCreateRect ? `
                <button class="btn btn-sm" style="margin-bottom:10px;width:100%" id="createRectBtn" data-rect-item-id="${item.id}">➕ 发起整改</button>
              ` : ''}
              ${activeRects.length === 0 && closedRects.length === 0 ? `
                <div class="text-muted" style="font-size:12px;text-align:center;padding:8px">暂无整改任务</div>
              ` : ''}
              ${activeRects.map(t => `
                <div class="rect-sidebar-card">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                    <span class="rect-status-tag" style="background:${RECTIFICATION_STATUS_COLORS[t.status]}">${RECTIFICATION_STATUS_LABELS[t.status]}</span>
                    <span class="text-muted" style="font-size:11px;margin-left:auto">${formatTime(t.updatedAt)}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px">${esc(t.requirement)}</div>
                  <div style="font-size:11px;color:var(--text-muted)">👤 ${esc(t.assignee)} ${t.planCompleteAt ? `· 📅 ${new Date(t.planCompleteAt).toLocaleDateString('zh-CN')}` : ''}</div>
                  <button class="btn btn-sm" style="margin-top:6px;font-size:11px" data-view-rect="${t.id}">查看详情</button>
                </div>
              `).join('')}
              ${closedRects.length > 0 ? `
                <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
                  <div class="text-muted" style="font-size:11px;margin-bottom:6px">已关闭 (${closedRects.length})</div>
                  ${closedRects.slice(0, 3).map(t => `
                    <div class="rect-sidebar-card" style="opacity:0.6">
                      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                        <span class="rect-status-tag" style="background:${RECTIFICATION_STATUS_COLORS[t.status]}">${RECTIFICATION_STATUS_LABELS[t.status]}</span>
                        <span class="text-muted" style="font-size:11px;margin-left:auto">${formatTime(t.updatedAt)}</span>
                      </div>
                      <div style="font-size:11px;color:var(--text-muted)">${esc(t.requirement).slice(0, 40)}${t.requirement.length > 40 ? '…' : ''}</div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            `
          })()}
        </div>
      </div>
      <div class="sidebar-footer">
        ${!readOnly ? `
          <button class="btn btn-danger btn-sm" id="deleteItemBtn">🗑 删除</button>
        ` : `<div class="spacer"></div><span class="text-muted" style="font-size:12px">审计员只读模式</span><div class="spacer"></div>`}
        <div class="spacer"></div>
        ${!readOnly ? `
          <button class="btn" id="resetDraftBtn">放弃修改</button>
          <button class="btn btn-primary" id="saveItemBtn">💾 保存更改</button>
        ` : ''}
      </div>
    </div>
  `
}

function renderRectificationPanel(s: AppState): string {
  if (!s.ui.rectificationPanelOpen) {
    return `<div class="rect-panel closed"></div>`
  }

  const filterStatus = s.ui.rectificationFilterStatus
  const filtered = store.getFilteredRectifications(filterStatus)
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const themeMap = new Map(s.themes.map(t => [t.id, t.name]))
  const canEditRect = canEdit(s.currentRole)

  const totalCounts: Record<string, number> = { all: s.rectifications.length }
  ;(['pending', 'in_progress', 'completed', 'closed'] as RectificationStatus[]).forEach(st => {
    totalCounts[st] = s.rectifications.filter(t => t.status === st).length
  })

  const selectedTask = s.ui.selectedRectificationId
    ? s.rectifications.find(t => t.id === s.ui.selectedRectificationId)
    : null

  return `
    <div class="rect-panel" id="rectPanel">
      <div class="rect-panel-header">
        <div class="rect-panel-title">
          🔄 整改闭环跟踪
          <span class="alert-count-badge" style="background:#8b5cf6">${s.rectifications.length}</span>
        </div>
        <button class="close-btn" id="closeRectBtn" title="关闭">×</button>
      </div>
      <div class="rect-filter-bar">
        <span class="rect-filter-chip ${filterStatus === 'all' ? 'active' : ''}" data-rect-filter="all">全部 ${totalCounts.all}</span>
        ${(['pending', 'in_progress', 'completed', 'closed'] as RectificationStatus[]).map(st => `
          <span class="rect-filter-chip ${filterStatus === st ? 'active' : ''}"
            data-rect-filter="${st}"
            style="${filterStatus === st ? `background:${RECTIFICATION_STATUS_COLORS[st]};border-color:${RECTIFICATION_STATUS_COLORS[st]};color:white` : ''}">
            ${RECTIFICATION_STATUS_LABELS[st]} ${totalCounts[st]}
          </span>
        `).join('')}
      </div>
      <div class="rect-panel-body">
        ${filtered.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div>暂无整改任务</div>
            <div style="margin-top:6px;font-size:12px">可在清单详情中发起整改</div>
          </div>
        ` : filtered.map(task => {
          const item = s.checklist.find(c => c.id === task.itemId)
          const areaName = item ? (areaMap.get(item.areaId) || '-') : '-'
          const themeName = item ? (themeMap.get(item.themeId) || '-') : '-'
          const isSelected = s.ui.selectedRectificationId === task.id
          const isOverdue = task.planCompleteAt && task.planCompleteAt < Date.now() && task.status !== 'completed' && task.status !== 'closed'

          return `
            <div class="rect-task-card ${isSelected ? 'selected' : ''} ${isOverdue ? 'overdue' : ''}" data-rect-id="${task.id}">
              <div class="rect-task-header">
                <span class="rect-status-tag" style="background:${RECTIFICATION_STATUS_COLORS[task.status]}">${RECTIFICATION_STATUS_LABELS[task.status]}</span>
                ${isOverdue ? '<span class="rect-overdue-tag">已逾期</span>' : ''}
                <span class="rect-task-time">${formatTime(task.updatedAt)}</span>
              </div>
              <div class="rect-task-title">${item ? esc(item.title) : '(关联清单项已删除)'}</div>
              <div class="rect-task-meta">
                <span>📍 ${esc(areaName)}</span>
                <span>👤 ${esc(task.assignee)}</span>
                ${task.planCompleteAt ? `<span>📅 ${new Date(task.planCompleteAt).toLocaleDateString('zh-CN')}</span>` : ''}
              </div>
              <div class="rect-task-req">${esc(task.requirement)}</div>
            </div>
          `
        }).join('')}
      </div>
      ${selectedTask ? renderRectDetail(s, selectedTask, canEditRect) : ''}
    </div>
  `
}

function renderRectDetail(s: AppState, task: RectificationTask, canEditRect: boolean): string {
  const item = s.checklist.find(c => c.id === task.itemId)
  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
  const areaName = item ? (areaMap.get(item.areaId) || '-') : '-'
  const isOverdue = task.planCompleteAt && task.planCompleteAt < Date.now() && task.status !== 'completed' && task.status !== 'closed'

  const nextActions: Record<RectificationStatus, Array<{ status: RectificationStatus; label: string; color: string }>> = {
    pending: [
      { status: 'in_progress', label: '开始处理', color: '#3b82f6' },
      { status: 'closed', label: '关闭任务', color: '#6b7280' }
    ],
    in_progress: [
      { status: 'completed', label: '标记完成', color: '#10b981' },
      { status: 'closed', label: '关闭任务', color: '#6b7280' }
    ],
    completed: [
      { status: 'closed', label: '关闭复核', color: '#6b7280' }
    ],
    closed: []
  }

  return `
    <div class="rect-detail-panel">
      <div class="rect-detail-header">
        <div style="font-weight:600;font-size:14px">整改详情</div>
        <button class="close-btn" id="closeRectDetailBtn" title="关闭详情" style="width:24px;height:24px;font-size:14px">×</button>
      </div>
      <div class="rect-detail-body">
        <div class="rect-detail-section">
          <div class="rect-detail-label">关联清单项</div>
          <div class="rect-detail-value">${item ? esc(item.title) : '(已删除)'}</div>
          ${item ? `<div class="rect-detail-sub">📍 ${esc(areaName)} · ${esc(item.displayLocation || '')}</div>` : ''}
        </div>
        <div class="rect-detail-section">
          <div class="rect-detail-label">整改要求</div>
          <div class="rect-detail-value">${esc(task.requirement)}</div>
        </div>
        <div class="rect-detail-section">
          <div class="rect-detail-label">责任人</div>
          <div class="rect-detail-value">${esc(task.assignee)}</div>
        </div>
        <div class="rect-detail-section">
          <div class="rect-detail-label">计划完成时间</div>
          <div class="rect-detail-value ${isOverdue ? 'text-danger' : ''}">
            ${task.planCompleteAt ? new Date(task.planCompleteAt).toLocaleString('zh-CN') : '未设置'}
            ${isOverdue ? ' (已逾期)' : ''}
          </div>
        </div>
        <div class="rect-detail-section">
          <div class="rect-detail-label">创建人 / 创建时间</div>
          <div class="rect-detail-value">${esc(task.createdBy)} · ${new Date(task.createdAt).toLocaleString('zh-CN')}</div>
        </div>
        ${task.closedBy ? `
          <div class="rect-detail-section">
            <div class="rect-detail-label">关闭人 / 关闭时间</div>
            <div class="rect-detail-value">${esc(task.closedBy)} · ${new Date(task.closedAt!).toLocaleString('zh-CN')}</div>
          </div>
        ` : ''}

        ${canEditRect && nextActions[task.status].length > 0 ? `
          <div class="rect-detail-section">
            <div class="rect-detail-label">操作</div>
            <div class="rect-detail-actions">
              <textarea class="form-textarea" id="rectActionRemark" placeholder="填写操作备注…" style="min-height:48px;margin-bottom:8px"></textarea>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                ${nextActions[task.status].map(a => `
                  <button class="btn btn-sm" style="background:${a.color};border-color:${a.color};color:white" data-rect-action="${a.status}" data-rect-id="${task.id}">${a.label}</button>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <div class="rect-detail-section">
          <div class="rect-detail-label">流转记录</div>
          <div class="rect-timeline">
            ${task.history.map((entry, idx) => {
              const fromLabel = entry.fromStatus ? RECTIFICATION_STATUS_LABELS[entry.fromStatus] : '—'
              const toLabel = RECTIFICATION_STATUS_LABELS[entry.toStatus]
              const toColor = RECTIFICATION_STATUS_COLORS[entry.toStatus]
              return `
                <div class="rect-timeline-item ${idx === task.history.length - 1 ? 'last' : ''}">
                  <div class="rect-timeline-dot" style="background:${toColor}"></div>
                  <div class="rect-timeline-content">
                    <div class="rect-timeline-title">
                      ${fromLabel} → <span style="color:${toColor};font-weight:600">${toLabel}</span>
                    </div>
                    <div class="rect-timeline-remark">${esc(entry.remark)}</div>
                    <div class="rect-timeline-meta">${esc(entry.operator)} · ${new Date(entry.timestamp).toLocaleString('zh-CN')}</div>
                  </div>
                </div>
              `
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `
}

function renderRectificationFormModal(s: AppState): string {
  if (!s.ui.rectificationFormOpen) {
    return `<div class="modal-overlay" id="rectFormOverlay"></div>`
  }

  const targetItemId = s.ui.rectificationFormItemId
  const targetItem = targetItemId ? s.checklist.find(c => c.id === targetItemId) : null

  return `
    <div class="modal-overlay open" id="rectFormOverlay">
      <div class="modal" style="max-width:520px">
        <div class="modal-header">
          <div class="modal-title">🔄 发起整改任务</div>
          <button class="close-btn" id="closeRectFormBtn">×</button>
        </div>
        <div class="modal-body">
          ${targetItem ? `
            <div style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);margin-bottom:16px;border:1px solid var(--border)">
              <div style="font-weight:600;margin-bottom:4px">${esc(targetItem.title)}</div>
              <div style="font-size:12px;color:var(--text-secondary)">
                当前状态：<span class="status-tag ${targetItem.status || 'unchecked'}" style="font-size:11px">${targetItem.status ? STATUS_LABELS[targetItem.status] : '未校对'}</span>
              </div>
            </div>
          ` : ''}
          <div class="form-grid" style="grid-template-columns:1fr">
            <div class="form-group full-width">
              <label class="form-label">整改要求 <span class="required">*</span></label>
              <textarea class="form-textarea" id="rectRequirement" placeholder="请描述需要整改的具体内容和标准…" style="min-height:80px">${targetItem?.rectificationRemark || ''}</textarea>
            </div>
            <div class="form-group full-width">
              <label class="form-label">责任人 <span class="required">*</span></label>
              <input type="text" class="form-input" id="rectAssignee" value="${esc(targetItem?.responsible || s.currentUser)}" placeholder="责任人姓名"/>
            </div>
            <div class="form-group full-width">
              <label class="form-label">计划完成时间</label>
              <input type="date" class="form-input" id="rectPlanDate"/>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="closeRectFormBtn2">取消</button>
          <button class="btn btn-primary" id="submitRectBtn" data-item-id="${targetItemId || ''}">提交整改任务</button>
        </div>
      </div>
    </div>
  `
}

function renderAdminModal(s: AppState, configReadOnly: boolean): string {
  if (!s.ui.adminPanelOpen) {
    return `<div class="modal-overlay" id="adminOverlay"></div>`
  }

  const tabs: Array<{ key: 'areas' | 'themes' | 'checkItems'; label: string; icon: string }> = [
    { key: 'areas', label: '门店区域', icon: '🏬' },
    { key: 'themes', label: '陈列主题', icon: '🎯' },
    { key: 'checkItems', label: '检查项', icon: '✅' }
  ]

  let body = ''
  if (s.ui.currentAdminTab === 'areas') {
    body = `
      <div class="admin-list">
        <div class="admin-list-header">
          <h4>门店区域管理（${s.areas.length}）</h4>
        </div>
        ${!configReadOnly ? `
          <div class="admin-add-form" id="areaAddForm">
            <input type="text" data-area="name" placeholder="区域名称 *" style="flex:2"/>
            <input type="text" data-area="desc" placeholder="描述说明"/>
            <button class="btn btn-primary btn-sm" id="addAreaBtn">+ 新增</button>
          </div>
        ` : ''}
        ${s.areas.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🏬</div>
            <div>还没有门店区域</div>
          </div>
        ` : s.areas.map(a => {
          const themeCount = s.themes.filter(t => t.areaId === a.id).length
          return `
            <div class="admin-item">
              <div class="admin-item-info">
                <div class="admin-item-name">${esc(a.name)}</div>
                ${a.description ? `<div class="admin-item-desc">${esc(a.description)}</div>` : ''}
                <div class="admin-item-meta">关联主题 ${themeCount} 个 · 创建于 ${formatTime(a.createdAt)}</div>
              </div>
              ${!configReadOnly ? `
                <div class="admin-item-actions">
                  <button class="btn btn-sm" data-edit-area="${a.id}">编辑</button>
                  <button class="btn btn-sm btn-danger" data-delete-area="${a.id}">删除</button>
                </div>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    `
  } else if (s.ui.currentAdminTab === 'themes') {
    const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
    body = `
      <div class="admin-list">
        <div class="admin-list-header">
          <h4>陈列主题管理（${s.themes.length}）</h4>
        </div>
        ${!configReadOnly ? `
          <div class="admin-add-form" id="themeAddForm">
            <input type="text" data-theme="name" placeholder="主题名称 *" style="flex:2"/>
            <select data-theme="areaId">
              <option value="">选择区域 *</option>
              ${s.areas.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
            </select>
            <input type="date" data-theme="validFrom" title="生效日期" style="flex:1;min-width:100px"/>
            <input type="date" data-theme="validTo" title="截止日期" style="flex:1;min-width:100px"/>
            <button class="btn btn-primary btn-sm" id="addThemeBtn">+ 新增</button>
          </div>
        ` : ''}
        ${s.themes.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎯</div>
            <div>还没有陈列主题</div>
          </div>
        ` : s.themes.map(t => {
          const ciCount = s.checkItems.filter(c => c.themeId === t.id).length
          const areaName = areaMap.get(t.areaId) || '-'
          const dateRange = t.validFrom && t.validTo ? ` · ${t.validFrom} ~ ${t.validTo}` : ''
          return `
            <div class="admin-item">
              <div class="admin-item-info">
                <div class="admin-item-name">${esc(t.name)} <span class="text-muted" style="font-weight:400;font-size:12px">[${esc(areaName)}]</span></div>
                ${t.description ? `<div class="admin-item-desc">${esc(t.description)}</div>` : ''}
                <div class="admin-item-meta">检查项 ${ciCount} 个${dateRange} · 创建于 ${formatTime(t.createdAt)}</div>
              </div>
              ${!configReadOnly ? `
                <div class="admin-item-actions">
                  <button class="btn btn-sm" data-edit-theme="${t.id}">编辑</button>
                  <button class="btn btn-sm btn-danger" data-delete-theme="${t.id}">删除</button>
                </div>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    `
  } else {
    const themeMap = new Map(s.themes.map(t => [t.id, t.name]))
    const areaMap = new Map(s.areas.map(a => [a.id, a.name]))
    body = `
      <div class="admin-list">
        <div class="admin-list-header">
          <h4>检查项管理（${s.checkItems.length}）</h4>
        </div>
        ${!configReadOnly ? `
          <div class="admin-add-form" id="ciAddForm">
            <input type="text" data-ci="name" placeholder="检查项名称 *" style="flex:2"/>
            <select data-ci="themeId">
              <option value="">选择主题 *</option>
              ${s.themes.map(t => {
                const areaName = areaMap.get(t.areaId) || ''
                return `<option value="${esc(t.id)}">${esc(areaName + ' / ' + t.name)}</option>`
              }).join('')}
            </select>
            <label class="checkbox-inline" style="flex:0 0 auto;justify-content:center;padding:0 8px">
              <input type="checkbox" data-ci="required" checked/> 必选
            </label>
            <button class="btn btn-primary btn-sm" id="addCiBtn">+ 新增</button>
          </div>
        ` : ''}
        ${s.checkItems.length === 0 ? `
          <div class="empty-state">
            <div class="empty-state-icon">✅</div>
            <div>还没有检查项</div>
          </div>
        ` : s.checkItems.map(c => {
          const theme = s.themes.find(t => t.id === c.themeId)
          const themeName = theme ? `${areaMap.get(theme.areaId) || ''} / ${theme.name}` : '-'
          return `
            <div class="admin-item">
              <div class="admin-item-info">
                <div class="admin-item-name">
                  ${esc(c.name)}
                  ${c.required ? '<span style="background:var(--danger);color:white;padding:1px 6px;border-radius:8px;font-size:10px;margin-left:6px">必选</span>' : ''}
                </div>
                ${c.description ? `<div class="admin-item-desc">${esc(c.description)}</div>` : ''}
                <div class="admin-item-meta">主题：${esc(themeName)} · 创建于 ${formatTime(c.createdAt)}</div>
              </div>
              ${!configReadOnly ? `
                <div class="admin-item-actions">
                  <button class="btn btn-sm" data-edit-ci="${c.id}">编辑</button>
                  <button class="btn btn-sm btn-danger" data-delete-ci="${c.id}">删除</button>
                </div>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
    `
  }

  return `
    <div class="modal-overlay open" id="adminOverlay">
      <div class="modal" style="max-width:720px">
        <div class="modal-header">
          <div class="modal-title">🔧 系统配置管理</div>
          <button class="close-btn" id="closeAdminBtn">×</button>
        </div>
        <div class="modal-tabs">
          ${tabs.map(t => `
            <button class="modal-tab ${s.ui.currentAdminTab === t.key ? 'active' : ''}" data-admin-tab="${t.key}">
              ${t.icon} ${t.label}
            </button>
          `).join('')}
        </div>
        <div class="modal-body">
          ${body}
        </div>
        <div class="modal-footer">
          <span class="text-muted" style="font-size:12px;margin-right:auto">
            最后保存于 ${new Date(s.lastSavedAt).toLocaleTimeString('zh-CN')}
          </span>
          <button class="btn" id="closeAdminBtn2">关闭</button>
        </div>
      </div>
    </div>
  `
}

function renderImportModal(s: AppState, readOnly: boolean): string {
  if (!s.ui.importModalOpen) {
    return `<div class="modal-overlay" id="importOverlay"></div>`
  }

  const areaMap = new Map(s.areas.map(a => [a.id, a.name]))

  return `
    <div class="modal-overlay open" id="importOverlay">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">📥 批量导入陈列清单</div>
          <button class="close-btn" id="closeImportBtn">×</button>
        </div>
        <div class="modal-body">
          <div class="import-dropzone" id="importDropzone">
            <div class="import-dropzone-icon">📄</div>
            <div class="import-dropzone-text">点击选择 CSV 文件，或将文件拖到此处</div>
            <div class="import-dropzone-sub">
              支持 CSV / TSV 格式，首行可为标题行。字段：标题、区域ID/名称、主题ID/名称、期望价格、责任人、陈列位置
            </div>
            <input type="file" id="importFileInput" accept=".csv,.tsv,.txt" style="display:none"/>
          </div>

          <div style="margin-top:20px">
            <div class="section-title" style="background:none;padding:0;border:none;margin-bottom:10px">
              💡 快速生成示例数据
            </div>
            <button class="btn" id="addSampleBtn">➕ 追加示例清单（当前区域/主题）</button>
          </div>

          <div class="section-title" style="background:none;padding:0;border:none;margin:24px 0 10px">
            📝 或手动添加单条记录
          </div>
          <div class="admin-add-form" id="manualAddForm" style="background:var(--bg);border-radius:var(--radius-sm);border:1px solid var(--border);padding:12px">
            <input type="text" data-manual="title" placeholder="陈列标题 *" style="flex:2;min-width:180px"/>
            <select data-manual="areaId">
              <option value="">区域 *</option>
              ${s.areas.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}
            </select>
            <select data-manual="themeId">
              <option value="">主题 *</option>
              ${s.themes.map(t => `<option value="${esc(t.id)}">${esc((areaMap.get(t.areaId) || '') + '/' + t.name)}</option>`).join('')}
            </select>
            <input type="text" data-manual="price" placeholder="价格" style="flex:0 0 100px"/>
            <input type="text" data-manual="responsible" placeholder="责任人" style="flex:0 0 100px"/>
            <button class="btn btn-primary btn-sm" id="addManualBtn">+ 添加</button>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" id="closeImportBtn2">关闭</button>
        </div>
      </div>
    </div>
  `
}

function renderColumnPopover(s: AppState): string {
  if (!s.ui.columnSettingsOpen || !columnPanelEl) return ''
  return ''
}

// ============ 事件绑定 ============
function bindEvents(): void {
  const s = store.getState()

  // 搜索框
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = (e.target as HTMLInputElement).value
      store.setFilters({ searchText: val })
    })
  }

  // 工具栏按钮
  document.getElementById('toggleFilterBtn')?.addEventListener('click', () => {
    const bar = document.querySelector('.filter-bar') as HTMLElement | null
    if (bar) bar.style.display = bar.style.display === 'none' ? '' : 'none'
  })
  document.getElementById('toggleAlertBtn')?.addEventListener('click', () => {
    store.setAlertPanelOpen(!s.ui.alertPanelOpen)
  })
  document.getElementById('closeAlertBtn')?.addEventListener('click', () => {
    store.setAlertPanelOpen(false)
  })
  document.getElementById('toggleRectBtn')?.addEventListener('click', () => {
    store.setRectificationPanelOpen(!s.ui.rectificationPanelOpen)
  })
  document.getElementById('closeRectBtn')?.addEventListener('click', () => {
    store.setRectificationPanelOpen(false)
  })
  document.getElementById('exportBtn')?.addEventListener('click', handleExport)
  document.getElementById('columnBtn')?.addEventListener('click', toggleColumnPanel)
  document.getElementById('adminBtn')?.addEventListener('click', () => {
    store.setAdminPanelOpen(true)
  })
  document.getElementById('importBtn')?.addEventListener('click', () => {
    store.setImportModalOpen(true)
  })
  document.getElementById('resetFilterBtn')?.addEventListener('click', () => {
    store.resetFilters()
  })

  // 角色切换
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = (btn as HTMLElement).dataset.role as UserRole
      const names: Record<UserRole, string> = {
        admin: '管理员',
        operator: s.currentRole === 'operator' ? s.currentUser : '张小明',
        auditor: '审计员'
      }
      store.setRole(role, names[role])
    })
  })

  // 筛选 chips
  document.querySelectorAll('[data-filter]').forEach(el => {
    el.addEventListener('click', () => {
      const type = (el as HTMLElement).dataset.filter
      const value = (el as HTMLElement).dataset.value!
      handleChipToggle(type!, value)
    })
  })

  // 告警类型头部点击：自动筛选 + 清理冲突筛选
  document.querySelectorAll('[data-filter-alert]').forEach(el => {
    el.addEventListener('click', () => {
      const alertType = (el as HTMLElement).dataset.filterAlert as AlertType
      store.applyAlertTypeFilter(alertType)
    })
  })

  // 告警条目点击：定位到对应条目
  document.querySelectorAll('[data-alert]').forEach(el => {
    el.addEventListener('click', () => {
      const alertId = (el as HTMLElement).dataset.alert!
      store.locateAlert(alertId)
      store.acknowledgeAlert(alertId)
      // 自动滚动
      requestAnimationFrame(() => {
        const state = store.getState()
        const row = document.querySelector(`[data-row-id="${state.ui.highlightedItemId}"]`) as HTMLElement | null
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        setTimeout(() => store.highlightItem(null), 2500)
      })
    })
  })

  // 整改面板筛选
  document.querySelectorAll('[data-rect-filter]').forEach(el => {
    el.addEventListener('click', () => {
      const filter = (el as HTMLElement).dataset.rectFilter as RectificationStatus | 'all'
      store.setRectificationFilterStatus(filter)
    })
  })

  // 整改任务卡片点击
  document.querySelectorAll('[data-rect-id]').forEach(el => {
    el.addEventListener('click', () => {
      const id = (el as HTMLElement).dataset.rectId!
      const currentState = store.getState()
      if (currentState.ui.selectedRectificationId === id) {
        store.selectRectification(null)
      } else {
        store.selectRectification(id)
      }
    })
  })

  // 整改详情关闭
  document.getElementById('closeRectDetailBtn')?.addEventListener('click', () => {
    store.selectRectification(null)
  })

  // 整改状态操作
  document.querySelectorAll('[data-rect-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const newStatus = (btn as HTMLElement).dataset.rectAction as RectificationStatus
      const taskId = (btn as HTMLElement).dataset.rectId!
      const remarkEl = document.getElementById('rectActionRemark') as HTMLTextAreaElement | null
      const remark = remarkEl?.value?.trim() || ''
      store.updateRectificationStatus(taskId, newStatus, remark)
    })
  })

  // 整改表单模态
  document.getElementById('closeRectFormBtn')?.addEventListener('click', () => {
    store.setRectificationFormOpen(false)
  })
  document.getElementById('closeRectFormBtn2')?.addEventListener('click', () => {
    store.setRectificationFormOpen(false)
  })
  document.getElementById('rectFormOverlay')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null
    if (target && target.id === 'rectFormOverlay') store.setRectificationFormOpen(false)
  })
  document.getElementById('submitRectBtn')?.addEventListener('click', () => {
    const itemId = (document.getElementById('submitRectBtn') as HTMLElement).dataset.itemId!
    const requirement = (document.getElementById('rectRequirement') as HTMLTextAreaElement).value.trim()
    const assignee = (document.getElementById('rectAssignee') as HTMLInputElement).value.trim()
    const planDate = (document.getElementById('rectPlanDate') as HTMLInputElement).value
    if (!requirement) { alert('请填写整改要求'); return }
    if (!assignee) { alert('请填写责任人'); return }
    const planCompleteAt = planDate ? new Date(planDate + 'T23:59:59').getTime() : null
    store.addRectificationTask(itemId, requirement, assignee, planCompleteAt)
    store.setRectificationFormOpen(false)
  })

  // 侧边栏中的"发起整改"按钮
  document.getElementById('createRectBtn')?.addEventListener('click', () => {
    const itemId = (document.getElementById('createRectBtn') as HTMLElement).dataset.rectItemId!
    store.setRectificationFormOpen(true, itemId)
  })

  // 侧边栏中的"查看详情"按钮（整改任务）
  document.querySelectorAll('[data-view-rect]').forEach(btn => {
    btn.addEventListener('click', () => {
      const rectId = (btn as HTMLElement).dataset.viewRect!
      store.setRectificationPanelOpen(true)
      store.selectRectification(rectId)
    })
  })

  // 列表中的整改定位标签
  document.querySelectorAll('[data-rect-locate]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const rectId = (el as HTMLElement).dataset.rectLocate!
      store.setRectificationPanelOpen(true)
      store.selectRectification(rectId)
    })
  })

  // 告警面板中的"整改"链接
  document.querySelectorAll('[data-alert-rect]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const alertId = (el as HTMLElement).dataset.alertRect!
      store.locateRectificationFromAlert(alertId)
    })
  })

  // 列表选择
  const selectAllChk = document.getElementById('selectAllChk') as HTMLInputElement | null
  if (selectAllChk) {
    selectAllChk.addEventListener('change', () => {
      const filtered = store.getFilteredChecklist()
      if (selectAllChk.checked) {
        filtered.forEach(i => selectedCheckboxes.add(i.id))
      } else {
        selectedCheckboxes.clear()
      }
      render()
    })
  }

  document.querySelectorAll('.row-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      e.stopPropagation()
      const id = (chk as HTMLInputElement).dataset.id!
      if ((chk as HTMLInputElement).checked) selectedCheckboxes.add(id)
      else selectedCheckboxes.delete(id)
      render()
    })
  })

  // 行点击
  document.querySelectorAll('[data-row-id]').forEach(tr => {
    tr.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('button')) return
      const id = (tr as HTMLElement).dataset.rowId!
      store.selectItem(id)
    })
  })

  // 快速操作按钮
  document.querySelectorAll('[data-quick]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id!
      const status = (btn as HTMLElement).dataset.quick as AuditStatus
      store.updateChecklistItem(id, { status })
    })
  })

  // 批量操作
  document.querySelectorAll('[data-batch]').forEach(btn => {
    btn.addEventListener('click', () => {
      const status = (btn as HTMLElement).dataset.batch as AuditStatus
      const ids = Array.from(selectedCheckboxes)
      if (ids.length === 0) return
      store.batchSetStatus(ids, status)
      selectedCheckboxes.clear()
    })
  })
  document.getElementById('clearSelectionBtn')?.addEventListener('click', () => {
    selectedCheckboxes.clear()
    render()
  })

  // 侧边栏关闭
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    store.selectItem(null)
  })
  document.getElementById('closeSidebarBtn')?.addEventListener('click', () => {
    store.selectItem(null)
  })

  // 侧边栏状态选择
  document.querySelectorAll('[data-status-value]').forEach(el => {
    el.addEventListener('click', () => {
      const val = (el as HTMLElement).dataset.statusValue
      const item = store.getState().ui.selectedItemId
      if (!item) return
      if (!editingDraft[item]) editingDraft[item] = {}
      if (val === '__clear__') editingDraft[item].status = null
      else editingDraft[item].status = val as AuditStatus
      render()
    })
  })

  // 侧边栏输入字段 draft
  const selectedId = store.getState().ui.selectedItemId
  if (selectedId) {
    const fields = ['title', 'expectedPrice', 'areaId', 'themeId', 'displayLocation',
      'responsible', 'notes', 'missingExplanation', 'rectificationRemark', 'hasPromoTag']
    fields.forEach(field => {
      document.querySelectorAll(`[data-field="${field}"]`).forEach(inp => {
        const evt = field === 'hasPromoTag' ? 'change' : 'input'
        inp.addEventListener(evt, (e: Event) => {
          if (!editingDraft[selectedId]) editingDraft[selectedId] = {}
          const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
          if (field === 'hasPromoTag') {
            editingDraft[selectedId].hasPromoTag = (target as HTMLInputElement).checked
          } else {
            editingDraft[selectedId][field as keyof ChecklistItem] = target.value as any
          }
          // 区域变更时，如果主题不属于新区域则清空
          if (field === 'areaId') {
            const newAreaId = target.value
            const curTheme = editingDraft[selectedId].themeId || store.getState().checklist.find(c => c.id === selectedId)?.themeId
            const validThemes = store.getState().themes.filter(t => t.areaId === newAreaId).map(t => t.id)
            if (curTheme && !validThemes.includes(curTheme)) {
              editingDraft[selectedId].themeId = validThemes[0] || ''
            }
            setTimeout(render, 0)
          }
        })
      })
    })
  }

  document.getElementById('saveItemBtn')?.addEventListener('click', () => {
    const id = store.getState().ui.selectedItemId
    if (!id || !editingDraft[id]) return
    store.updateChecklistItem(id, editingDraft[id])
    delete editingDraft[id]
  })

  document.getElementById('resetDraftBtn')?.addEventListener('click', () => {
    const id = store.getState().ui.selectedItemId
    if (id) delete editingDraft[id]
    render()
  })

  document.getElementById('deleteItemBtn')?.addEventListener('click', () => {
    const id = store.getState().ui.selectedItemId
    if (!id) return
    if (!confirm('确定要删除这条记录吗？')) return
    store.deleteChecklistItem(id)
    delete editingDraft[id]
  })

  // 管理面板
  document.getElementById('adminOverlay')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null
    if (target && target.id === 'adminOverlay') store.setAdminPanelOpen(false)
  })
  document.getElementById('closeAdminBtn')?.addEventListener('click', () => store.setAdminPanelOpen(false))
  document.getElementById('closeAdminBtn2')?.addEventListener('click', () => store.setAdminPanelOpen(false))

  document.querySelectorAll('[data-admin-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.adminTab as 'areas' | 'themes' | 'checkItems'
      store.setAdminTab(tab)
    })
  })

  // 区域管理
  document.getElementById('addAreaBtn')?.addEventListener('click', () => {
    const form = document.getElementById('areaAddForm')!
    const name = (form.querySelector('[data-area="name"]') as HTMLInputElement).value.trim()
    const desc = (form.querySelector('[data-area="desc"]') as HTMLInputElement).value.trim()
    if (!name) { alert('请输入区域名称'); return }
    store.addArea(name, desc || undefined)
  })
  document.querySelectorAll('[data-edit-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.editArea!
      const area = store.getState().areas.find(a => a.id === id)
      if (!area) return
      const name = prompt('编辑区域名称', area.name)
      if (name === null) return
      const desc = prompt('编辑描述', area.description || '')
      if (desc === null) return
      store.updateArea(id, name.trim() || area.name, desc || undefined)
    })
  })
  document.querySelectorAll('[data-delete-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.deleteArea!
      if (!confirm('删除区域会同时删除关联的主题、检查项和所有清单记录，确认继续？')) return
      store.deleteArea(id)
    })
  })

  // 主题管理
  document.getElementById('addThemeBtn')?.addEventListener('click', () => {
    const form = document.getElementById('themeAddForm')!
    const name = (form.querySelector('[data-theme="name"]') as HTMLInputElement).value.trim()
    const areaId = (form.querySelector('[data-theme="areaId"]') as HTMLSelectElement).value
    const validFrom = (form.querySelector('[data-theme="validFrom"]') as HTMLInputElement).value
    const validTo = (form.querySelector('[data-theme="validTo"]') as HTMLInputElement).value
    if (!name || !areaId) { alert('请填写主题名称并选择区域'); return }
    store.addTheme(name, areaId, validFrom || undefined, validTo || undefined)
  })
  document.querySelectorAll('[data-edit-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.editTheme!
      const t = store.getState().themes.find(x => x.id === id)
      if (!t) return
      const name = prompt('编辑主题名称', t.name)
      if (name === null) return
      store.updateTheme(id, { name: name.trim() || t.name })
    })
  })
  document.querySelectorAll('[data-delete-theme]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.deleteTheme!
      if (!confirm('删除主题会同时删除关联的检查项和清单记录，确认继续？')) return
      store.deleteTheme(id)
    })
  })

  // 检查项管理
  document.getElementById('addCiBtn')?.addEventListener('click', () => {
    const form = document.getElementById('ciAddForm')!
    const name = (form.querySelector('[data-ci="name"]') as HTMLInputElement).value.trim()
    const themeId = (form.querySelector('[data-ci="themeId"]') as HTMLSelectElement).value
    const required = (form.querySelector('[data-ci="required"]') as HTMLInputElement).checked
    if (!name || !themeId) { alert('请填写检查项名称并选择主题'); return }
    store.addCheckItem(name, themeId, required)
  })
  document.querySelectorAll('[data-edit-ci]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.editCi!
      const c = store.getState().checkItems.find(x => x.id === id)
      if (!c) return
      const name = prompt('编辑检查项名称', c.name)
      if (name === null) return
      store.updateCheckItem(id, { name: name.trim() || c.name })
    })
  })
  document.querySelectorAll('[data-delete-ci]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.deleteCi!
      if (!confirm('确认删除该检查项？')) return
      store.deleteCheckItem(id)
    })
  })

  // 导入面板
  document.getElementById('importOverlay')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null
    if (target && target.id === 'importOverlay') store.setImportModalOpen(false)
  })
  document.getElementById('closeImportBtn')?.addEventListener('click', () => store.setImportModalOpen(false))
  document.getElementById('closeImportBtn2')?.addEventListener('click', () => store.setImportModalOpen(false))

  const dropzone = document.getElementById('importDropzone')
  const fileInput = document.getElementById('importFileInput') as HTMLInputElement | null
  if (dropzone && fileInput) {
    dropzone.addEventListener('click', () => fileInput.click())
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault()
      dropzone.classList.add('dragging')
    })
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'))
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault()
      dropzone.classList.remove('dragging')
      const files = (e as DragEvent).dataTransfer?.files
      if (files && files.length > 0) handleImportFile(files[0])
    })
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) handleImportFile(fileInput.files[0])
    })
  }

  document.getElementById('addSampleBtn')?.addEventListener('click', () => {
    const st = store.getState()
    if (st.areas.length === 0 || st.themes.length === 0) {
      alert('请先创建区域和主题')
      return
    }
    const samples = [
      { title: '新增商品A陈列', areaIdx: 0, price: '¥19.9', resp: st.currentUser, loc: '主通道1层' },
      { title: '新增商品B陈列', areaIdx: 1, price: '¥29.9', resp: st.currentUser, loc: '冷柜醒目位' },
      { title: '新增促销堆头', areaIdx: 2, price: '¥99.0', resp: '', loc: '货架端头' }
    ]
    const items = samples.map(s => {
      const area = st.areas[s.areaIdx % st.areas.length]
      const themesInArea = st.themes.filter(t => t.areaId === area.id)
      const theme = themesInArea[0] || st.themes[0]
      return {
        areaId: area.id,
        themeId: theme.id,
        title: s.title,
        expectedPrice: s.price,
        responsible: s.resp,
        displayLocation: s.loc,
        status: null as AuditStatus | null
      }
    })
    store.bulkImportChecklist(items)
    alert(`已追加 ${items.length} 条示例记录`)
  })

  document.getElementById('addManualBtn')?.addEventListener('click', () => {
    const form = document.getElementById('manualAddForm')!
    const title = (form.querySelector('[data-manual="title"]') as HTMLInputElement).value.trim()
    const areaId = (form.querySelector('[data-manual="areaId"]') as HTMLSelectElement).value
    const themeId = (form.querySelector('[data-manual="themeId"]') as HTMLSelectElement).value
    const price = (form.querySelector('[data-manual="price"]') as HTMLInputElement).value
    const responsible = (form.querySelector('[data-manual="responsible"]') as HTMLInputElement).value
    if (!title || !areaId || !themeId) {
      alert('请填写标题并选择区域和主题')
      return
    }
    store.addChecklistItem({
      areaId, themeId, title,
      expectedPrice: price || undefined,
      responsible: responsible || undefined
    })
    alert('添加成功')
    ;(form.querySelector('[data-manual="title"]') as HTMLInputElement).value = ''
    ;(form.querySelector('[data-manual="price"]') as HTMLInputElement).value = ''
    ;(form.querySelector('[data-manual="responsible"]') as HTMLInputElement).value = ''
  })
}

function handleChipToggle(type: string, value: string): void {
  const s = store.getState()
  const f = s.filters
  let patch: Partial<typeof f> = {}
  if (type === 'area') {
    patch.areaIds = f.areaIds.includes(value) ? f.areaIds.filter(v => v !== value) : [...f.areaIds, value]
  } else if (type === 'theme') {
    patch.themeIds = f.themeIds.includes(value) ? f.themeIds.filter(v => v !== value) : [...f.themeIds, value]
  } else if (type === 'responsible') {
    // 如果点击的是"未指定"特殊值，需要特殊处理
    if (value === '__none__') {
      patch.responsible = f.responsible.includes('__none__') ? f.responsible.filter(v => v !== '__none__') : [...f.responsible, '__none__']
    } else {
      patch.responsible = f.responsible.includes(value) ? f.responsible.filter(v => v !== value) : [...f.responsible, value]
    }
  } else if (type === 'status') {
    // 未校对也特殊处理
    patch.statuses = f.statuses.includes(value as AuditStatus)
      ? f.statuses.filter(v => v !== value as AuditStatus)
      : [...f.statuses, value as AuditStatus]
  } else if (type === 'alert') {
    patch.alertTypes = f.alertTypes.includes(value as AlertType)
      ? f.alertTypes.filter(v => v !== value as AlertType)
      : [...f.alertTypes, value as AlertType]
  }
  store.setFilters(patch)
}

function handleExport(): void {
  const csv = store.exportChecklistToCSV()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `陈列核对结果_${date}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toggleColumnPanel(): void {
  const s = store.getState()
  store.setColumnSettingsOpen(!s.ui.columnSettingsOpen)

  if (!s.ui.columnSettingsOpen) {
    columnPanelEl = null
    render()
    return
  }

  setTimeout(() => {
    const anchor = document.getElementById('columnBtn')
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const panel = document.createElement('div')
    panel.className = 'popover column-panel'
    panel.style.top = (rect.bottom + 6) + 'px'
    panel.style.right = (window.innerWidth - rect.right) + 'px'
    panel.innerHTML = `
      <div style="font-weight:600;margin-bottom:10px;border-bottom:1px solid var(--border);padding-bottom:8px">📊 列显示设置</div>
      ${COLUMN_ORDER.map(col => `
        <label class="column-option">
          <input type="checkbox" ${s.columns[col] ? 'checked' : ''} data-col="${col}"/>
          ${COLUMN_LABELS[col]}
        </label>
      `).join('')}
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:6px">
        <button class="btn btn-sm" id="colsAll">全选</button>
        <button class="btn btn-sm" id="colsReset">默认</button>
      </div>
    `
    document.body.appendChild(panel)
    columnPanelEl = panel

    panel.querySelectorAll('[data-col]').forEach(chk => {
      chk.addEventListener('change', () => {
        const col = (chk as HTMLInputElement).dataset.col as ColumnKey
        store.toggleColumn(col)
        // 重新渲染面板的选中状态需要手动刷新，这里简单处理直接重建
        setTimeout(toggleColumnPanel, 0)
        setTimeout(toggleColumnPanel, 0)
      })
    })
    panel.querySelector('#colsAll')?.addEventListener('click', () => {
      COLUMN_ORDER.forEach(col => {
        if (!store.getState().columns[col]) store.toggleColumn(col)
      })
    })
    panel.querySelector('#colsReset')?.addEventListener('click', () => {
      const cur = store.getState().columns
      ;(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).forEach(col => {
        if (cur[col] !== DEFAULT_COLUMNS[col]) store.toggleColumn(col)
      })
    })

    // 点击外部关闭
    const onClickOutside = (ev: MouseEvent) => {
      if (!panel.contains(ev.target as Node) && ev.target !== anchor && !(ev.target as HTMLElement).closest('#columnBtn')) {
        document.removeEventListener('mousedown', onClickOutside)
        store.setColumnSettingsOpen(false)
        if (columnPanelEl && columnPanelEl.parentNode) columnPanelEl.parentNode.removeChild(columnPanelEl)
        columnPanelEl = null
        render()
      }
    }
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0)
  }, 0)

  bindDashboardEvents()
}

function handleImportFile(file: File): void {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const text = String(reader.result || '')
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0)
      if (lines.length === 0) { alert('文件为空'); return }

      const sep = lines[0].includes('\t') ? '\t' : ','
      const header = lines[0].split(sep).map(s => s.trim().replace(/^"|"$/g, ''))
      const hasHeaderRow = /(标题|名称|区域|主题|价格)/i.test(header.join(' '))
      const dataLines = hasHeaderRow ? lines.slice(1) : lines

      const st = store.getState()
      const areaByName = new Map(st.areas.map(a => [a.name, a.id]))
      const themeByName = new Map(st.themes.map(t => [t.name, t.id]))

      const items: Array<Partial<ChecklistItem> & Pick<ChecklistItem, 'areaId' | 'themeId' | 'title'>> = []
      for (let i = 0; i < dataLines.length; i++) {
        const cols = dataLines[i].split(sep).map(s => s.trim().replace(/^"|"$/g, ''))
        if (cols.length < 3) continue
        let areaId = st.areas[0]?.id || ''
        let themeId = st.themes[0]?.id || ''
        let title = ''
        let price: string | undefined
        let resp: string | undefined
        let loc: string | undefined

        if (hasHeaderRow) {
          title = cols[header.findIndex(h => /标题|商品|名称/.test(h))] || cols[0]
          const areaColIdx = header.findIndex(h => /区域/.test(h))
          const themeColIdx = header.findIndex(h => /主题/.test(h))
          const priceColIdx = header.findIndex(h => /价格/.test(h))
          const respColIdx = header.findIndex(h => /责任|负责人/.test(h))
          const locColIdx = header.findIndex(h => /位置|地点|区域.*位置/.test(h) && /位置/.test(h))
          if (areaColIdx >= 0) {
            const v = cols[areaColIdx]
            areaId = areaByName.get(v) || st.areas.find(a => a.id === v)?.id || areaId
          }
          if (themeColIdx >= 0) {
            const v = cols[themeColIdx]
            themeId = themeByName.get(v) || st.themes.find(t => t.id === v)?.id || themeId
          }
          if (priceColIdx >= 0) price = cols[priceColIdx] || undefined
          if (respColIdx >= 0) resp = cols[respColIdx] || undefined
          if (locColIdx >= 0) loc = cols[locColIdx] || undefined
        } else {
          title = cols[0]
          if (cols[1]) areaId = areaByName.get(cols[1]) || st.areas.find(a => a.id === cols[1])?.id || areaId
          if (cols[2]) themeId = themeByName.get(cols[2]) || st.themes.find(t => t.id === cols[2])?.id || themeId
          if (cols[3]) price = cols[3] || undefined
          if (cols[4]) resp = cols[4] || undefined
          if (cols[5]) loc = cols[5] || undefined
        }

        if (!title || !areaId || !themeId) continue
        items.push({ title, areaId, themeId, expectedPrice: price, responsible: resp, displayLocation: loc })
      }

      if (items.length === 0) {
        alert('没有解析到有效的记录，请检查文件格式')
        return
      }
      store.bulkImportChecklist(items)
      alert(`成功导入 ${items.length} 条记录`)
    } catch (e) {
      console.error(e)
      alert('导入失败：' + (e instanceof Error ? e.message : '未知错误'))
    }
  }
  reader.readAsText(file, 'utf-8')
}

function setupKeyboardShortcuts(): void {
  document.removeEventListener('keydown', handleKeydown)
  document.addEventListener('keydown', handleKeydown)
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.target && (e.target as HTMLElement).tagName && ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
    return
  }

  const s = store.getState()
  const filtered = store.getFilteredChecklist()

  // 按 N 跳到下一条告警（使用当前可见范围）
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault()
    const visibleAlerts = store.getVisibleAlerts()
    if (visibleAlerts.length === 0) {
      // 如果当前没有可见告警，自动清除告警筛选以便显示
      store.setFilters({ alertTypes: [] })
      return
    }
    const unacked = visibleAlerts.filter(a => !a.acknowledged)
    const pool = unacked.length > 0 ? unacked : visibleAlerts
    if (pool.length === 0) return
    alertPointer = (alertPointer + 1) % pool.length
    const nextAlert = pool[alertPointer]
    store.locateAlert(nextAlert.id)
    requestAnimationFrame(() => {
      const st = store.getState()
      const row = document.querySelector(`[data-row-id="${st.ui.highlightedItemId}"]`) as HTMLElement | null
      if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setTimeout(() => store.highlightItem(null), 2500)
    })
    return
  }

  // 数字键 1-4 标记状态：作用于选中行
  if (['1', '2', '3', '4'].includes(e.key)) {
    const statusMap: Record<string, AuditStatus> = {
      '1': 'normal',
      '2': 'need_supply',
      '3': 'need_review',
      '4': 'pending'
    }
    const target = statusMap[e.key]

    if (selectedCheckboxes.size > 0 && canEdit(s.currentRole)) {
      e.preventDefault()
      store.batchSetStatus(Array.from(selectedCheckboxes), target)
      selectedCheckboxes.clear()
      return
    }

    // 如果没有批量选择，但侧边栏已打开，则作用于当前编辑项
    const selId = s.ui.selectedItemId
    if (selId && canEdit(s.currentRole)) {
      e.preventDefault()
      store.updateChecklistItem(selId, { status: target })
    }
    return
  }

  // 按 Escape 关闭侧边栏或弹层
  if (e.key === 'Escape') {
    if (s.ui.rectificationFormOpen) { store.setRectificationFormOpen(false); return }
    if (s.ui.adminPanelOpen) { store.setAdminPanelOpen(false); return }
    if (s.ui.importModalOpen) { store.setImportModalOpen(false); return }
    if (s.ui.sidebarOpen) { store.selectItem(null); return }
  }
}

// ============ 复盘看板 ============
function renderDashboard(s: AppState): string {
  const stats = store.generateDashboardStats()
  const readOnly = !canEdit(s.currentRole)

  return `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <div class="dashboard-title">
          <h2>📊 复盘看板</h2>
          <p class="dashboard-subtitle">当前筛选范围内的校对执行概况</p>
        </div>
        <div class="dashboard-actions">
          ${!readOnly ? `
            <button class="btn btn-primary" id="dashboardSummaryBtn">
              📝 一键生成复盘摘要
            </button>
          ` : ''}
        </div>
      </div>

      <div class="dashboard-grid">
        ${renderProgressCard(stats)}
        ${renderStatusCards(stats)}
        ${renderAlertTypeCard(stats)}
        ${renderResponsibleRankingCard(stats)}
        ${renderRectificationCard(stats)}
      </div>
    </div>
  `
}

function renderProgressCard(stats: ReturnType<typeof store.generateDashboardStats>): string {
  return `
    <div class="dash-card dash-card-wide dash-card-progress">
      <div class="dash-card-header">
        <span class="dash-card-icon">📈</span>
        <span class="dash-card-title">校对进度</span>
      </div>
      <div class="dash-progress-main">
        <div class="dash-progress-circle" style="--progress: ${stats.checkProgress}%">
          <div class="dash-progress-circle-inner">
            <span class="dash-progress-percent">${stats.checkProgress}%</span>
            <span class="dash-progress-label">完成率</span>
          </div>
        </div>
        <div class="dash-progress-stats">
          <div class="dash-progress-item">
            <span class="dash-progress-num">${stats.totalItems}</span>
            <span class="dash-progress-text">总项数</span>
          </div>
          <div class="dash-progress-item">
            <span class="dash-progress-num" style="color:var(--success)">${stats.checkedCount}</span>
            <span class="dash-progress-text">已校对</span>
          </div>
          <div class="dash-progress-item">
            <span class="dash-progress-num" style="color:var(--text-muted)">${stats.uncheckedCount}</span>
            <span class="dash-progress-text">未校对</span>
          </div>
        </div>
      </div>
      <div class="dash-card-footer">
        <span class="dash-card-hint">点击查看未校对项 →</span>
        <button class="dash-card-link" data-drill="unchecked">去核对</button>
      </div>
    </div>
  `
}

function renderStatusCards(stats: ReturnType<typeof store.generateDashboardStats>): string {
  const statusItems = [
    { key: 'normal', label: '正常', count: stats.normalCount, color: STATUS_COLORS.normal, icon: '✅' },
    { key: 'need_supply', label: '需补充', count: stats.needSupplyCount, color: STATUS_COLORS.need_supply, icon: '📦' },
    { key: 'need_review', label: '需复核', count: stats.needReviewCount, color: STATUS_COLORS.need_review, icon: '⚠️' },
    { key: 'pending', label: '暂缓处理', count: stats.pendingCount, color: STATUS_COLORS.pending, icon: '⏸️' }
  ]

  return `
    <div class="dash-card dash-card-status">
      <div class="dash-card-header">
        <span class="dash-card-icon">📋</span>
        <span class="dash-card-title">校对状态分布</span>
      </div>
      <div class="dash-status-grid">
        ${statusItems.map(item => `
          <div class="dash-status-item" data-drill-status="${item.key}" style="cursor:pointer">
            <div class="dash-status-icon" style="background:${item.color}20;color:${item.color}">
              ${item.icon}
            </div>
            <div class="dash-status-num" style="color:${item.color}">${item.count}</div>
            <div class="dash-status-label">${item.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderAlertTypeCard(stats: ReturnType<typeof store.generateDashboardStats>): string {
  const alertTypes = Object.entries(stats.alertTypeDistribution)
    .map(([type, count]) => ({
      type,
      count,
      label: ALERT_LABELS[type as AlertType],
      color: ALERT_COLORS[type as AlertType]
    }))
    .sort((a, b) => b.count - a.count)

  const maxCount = Math.max(...alertTypes.map(a => a.count), 1)

  return `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-icon">🔔</span>
        <span class="dash-card-title">告警类型分布</span>
        <span class="dash-card-badge" style="background:var(--danger)">${stats.totalAlerts}</span>
      </div>
      <div class="dash-alert-list">
        ${alertTypes.length === 0 ? `
          <div class="empty-state" style="padding:20px">
            <div class="empty-state-icon">✅</div>
            <div>暂无告警</div>
          </div>
        ` : alertTypes.map(item => `
          <div class="dash-alert-item" data-drill-alert="${item.type}" style="cursor:pointer">
            <div class="dash-alert-info">
              <span class="dash-alert-dot" style="background:${item.color}"></span>
              <span class="dash-alert-label">${item.label}</span>
            </div>
            <div class="dash-alert-bar-wrap">
              <div class="dash-alert-bar" style="width:${(item.count / maxCount) * 100}%;background:${item.color}"></div>
            </div>
            <span class="dash-alert-count">${item.count}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderResponsibleRankingCard(stats: ReturnType<typeof store.generateDashboardStats>): string {
  const topList = stats.responsibleIssueRanking.slice(0, 6)
  const maxIssue = Math.max(...topList.map(r => r.issueCount), 1)

  return `
    <div class="dash-card">
      <div class="dash-card-header">
        <span class="dash-card-icon">👥</span>
        <span class="dash-card-title">责任人问题排行</span>
      </div>
      <div class="dash-ranking-list">
        ${topList.length === 0 ? `
          <div class="empty-state" style="padding:20px">
            <div class="empty-state-icon">👤</div>
            <div>暂无责任人数据</div>
          </div>
        ` : topList.map((item, idx) => `
          <div class="dash-ranking-item" data-drill-responsible="${esc(item.name)}" style="cursor:pointer">
            <div class="dash-ranking-rank ${idx < 3 ? 'top' : ''}">${idx + 1}</div>
            <div class="dash-ranking-name">
              <span class="dash-ranking-title">${esc(item.name)}</span>
              <span class="dash-ranking-sub">共 ${item.totalCount} 项</span>
            </div>
            <div class="dash-ranking-bar-wrap">
              <div class="dash-ranking-bar" style="width:${(item.issueCount / maxIssue) * 100}%"></div>
            </div>
            <span class="dash-ranking-count">${item.issueCount}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

function renderRectificationCard(stats: ReturnType<typeof store.generateDashboardStats>): string {
  const rectItems = [
    { key: 'pending', label: '待处理', count: stats.rectificationStatusDistribution.pending, color: RECTIFICATION_STATUS_COLORS.pending },
    { key: 'in_progress', label: '处理中', count: stats.rectificationStatusDistribution.in_progress, color: RECTIFICATION_STATUS_COLORS.in_progress },
    { key: 'completed', label: '已完成', count: stats.rectificationStatusDistribution.completed, color: RECTIFICATION_STATUS_COLORS.completed },
    { key: 'closed', label: '已关闭', count: stats.rectificationStatusDistribution.closed, color: RECTIFICATION_STATUS_COLORS.closed }
  ]

  return `
    <div class="dash-card dash-card-wide">
      <div class="dash-card-header">
        <span class="dash-card-icon">🔄</span>
        <span class="dash-card-title">整改任务状态</span>
        <span class="dash-card-badge" style="background:#8b5cf6">${stats.totalRectifications}</span>
      </div>
      <div class="dash-rect-grid">
        ${rectItems.map(item => `
          <div class="dash-rect-item" data-drill-rect="${item.key}" style="cursor:pointer">
            <div class="dash-rect-num" style="color:${item.color}">${item.count}</div>
            <div class="dash-rect-label">${item.label}</div>
            <div class="dash-rect-bar" style="background:${item.color}20">
              <div class="dash-rect-bar-fill" style="width:${stats.totalRectifications > 0 ? (item.count / stats.totalRectifications) * 100 : 0}%;background:${item.color}"></div>
            </div>
          </div>
        `).join('')}
        <div class="dash-rect-item dash-rect-overdue ${stats.overdueRectificationCount > 0 ? 'has-overdue' : ''}" data-drill-rect="overdue" style="cursor:pointer">
          <div class="dash-rect-num" style="color:var(--danger)">${stats.overdueRectificationCount}</div>
          <div class="dash-rect-label">已逾期</div>
          <div class="dash-rect-bar" style="background:#fee2e2">
            <div class="dash-rect-bar-fill" style="width:${stats.totalRectifications > 0 ? (stats.overdueRectificationCount / stats.totalRectifications) * 100 : 0}%;background:var(--danger)"></div>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderSummaryModal(s: AppState): string {
  if (!s.ui.summaryModalOpen) {
    return `<div class="modal-overlay" id="summaryOverlay"></div>`
  }

  const summary = store.generateReviewSummary()
  const readOnly = !canEdit(s.currentRole)

  return `
    <div class="modal-overlay open" id="summaryOverlay">
      <div class="modal" style="max-width:640px">
        <div class="modal-header">
          <div class="modal-title">📝 复盘摘要</div>
          <button class="close-btn" id="closeSummaryBtn">×</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom:12px">
            <span class="text-muted" style="font-size:12px">
              基于当前筛选范围自动生成，可直接复制到日报
            </span>
          </div>
          <div class="summary-content" id="summaryContent">${esc(summary).replace(/\n/g, '<br>')}</div>
        </div>
        <div class="modal-footer">
          <span class="text-muted" style="font-size:12px;margin-right:auto">
            ${readOnly ? '审计员只读模式' : ''}
          </span>
          <button class="btn" id="closeSummaryBtn2">关闭</button>
          <button class="btn btn-primary" id="copySummaryBtn">📋 复制全文</button>
        </div>
      </div>
    </div>
  `
}

function bindDashboardEvents(): void {
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = (btn as HTMLElement).dataset.view as 'list' | 'dashboard'
      store.setCurrentView(view)
    })
  })

  const generateSummaryBtn = document.getElementById('generateSummaryBtn')
  if (generateSummaryBtn) {
    generateSummaryBtn.addEventListener('click', () => {
      store.setSummaryModalOpen(true)
    })
  }

  const dashboardSummaryBtn = document.getElementById('dashboardSummaryBtn')
  if (dashboardSummaryBtn) {
    dashboardSummaryBtn.addEventListener('click', () => {
      store.setSummaryModalOpen(true)
    })
  }

  const closeSummaryBtn = document.getElementById('closeSummaryBtn')
  if (closeSummaryBtn) {
    closeSummaryBtn.addEventListener('click', () => {
      store.setSummaryModalOpen(false)
    })
  }

  const closeSummaryBtn2 = document.getElementById('closeSummaryBtn2')
  if (closeSummaryBtn2) {
    closeSummaryBtn2.addEventListener('click', () => {
      store.setSummaryModalOpen(false)
    })
  }

  const summaryOverlay = document.getElementById('summaryOverlay')
  if (summaryOverlay) {
    summaryOverlay.addEventListener('click', (e) => {
      if (e.target === summaryOverlay) {
        store.setSummaryModalOpen(false)
      }
    })
  }

  const copySummaryBtn = document.getElementById('copySummaryBtn')
  if (copySummaryBtn) {
    copySummaryBtn.addEventListener('click', async () => {
      const summary = store.generateReviewSummary()
      try {
        await navigator.clipboard.writeText(summary)
        const originalText = copySummaryBtn.textContent
        copySummaryBtn.textContent = '✅ 已复制'
        setTimeout(() => {
          copySummaryBtn.textContent = originalText
        }, 2000)
      } catch {
        const textarea = document.createElement('textarea')
        textarea.value = summary
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        const originalText = copySummaryBtn.textContent
        copySummaryBtn.textContent = '✅ 已复制'
        setTimeout(() => {
          copySummaryBtn.textContent = originalText
        }, 2000)
      }
    })
  }

  document.querySelectorAll('[data-drill="unchecked"]').forEach(el => {
    el.addEventListener('click', () => {
      store.drillDownByStatus('unchecked')
    })
  })

  document.querySelectorAll('[data-drill-status]').forEach(el => {
    el.addEventListener('click', () => {
      const status = (el as HTMLElement).dataset.drillStatus as AuditStatus
      store.drillDownByStatus(status)
    })
  })

  document.querySelectorAll('[data-drill-alert]').forEach(el => {
    el.addEventListener('click', () => {
      const alertType = (el as HTMLElement).dataset.drillAlert as AlertType
      store.drillDownByAlertType(alertType)
    })
  })

  document.querySelectorAll('[data-drill-responsible]').forEach(el => {
    el.addEventListener('click', () => {
      const responsible = (el as HTMLElement).dataset.drillResponsible || ''
      store.drillDownByResponsible(responsible)
    })
  })

  document.querySelectorAll('[data-drill-rect]').forEach(el => {
    el.addEventListener('click', () => {
      const status = (el as HTMLElement).dataset.drillRect as RectificationStatus | 'overdue'
      store.drillDownByRectificationStatus(status)
    })
  })
}

// ============ 入口 ============
function bootstrap(): void {
  store.subscribe(() => {
    render()
  })
  store.loadState()
}

// DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap)
} else {
  bootstrap()
}
