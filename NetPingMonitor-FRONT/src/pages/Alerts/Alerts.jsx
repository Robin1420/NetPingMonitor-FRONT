import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Avatar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Select,
  SelectItem,
  Switch,
  Tab,
  Tabs,
  Textarea,
} from '@heroui/react'
import {
  ArrowLeftOnRectangleIcon,
  BellAlertIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import gponLogo from '../../assets/img/Gponlogo.jpg'
import {
  API_BASE_URL,
  apiFetch,
  clearAuthTokens,
  getAuthToken,
} from '../../utils/apiClient'
import '../Dashboard/Dashboard.css'
import './Alerts.css'

const NAV_ITEMS = [
  {
    id: 'overview',
    label: 'Resumen',
    hint: 'Vista general',
    icon: Squares2X2Icon,
    route: '/dashboard',
  },
  {
    id: 'alerts',
    label: 'Alertas',
    hint: 'Eventos y ack',
    icon: BellAlertIcon,
    route: '/alerts',
  },
  {
    id: 'history',
    label: 'Historial',
    hint: 'JSON por hora',
    icon: ClockIcon,
    route: '/history',
  },
  {
    id: 'reports',
    label: 'Reportes',
    hint: 'Exportaciones',
    icon: DocumentChartBarIcon,
  },
  {
    id: 'users',
    label: 'Usuarios',
    hint: 'Roles y accesos',
    icon: UsersIcon,
  },
  {
    id: 'settings',
    label: 'Config',
    hint: 'Parametros',
    icon: Cog6ToothIcon,
    route: '/config',
  },
]

const STATUS_META = {
  open: { label: 'Abierta', color: 'danger' },
  acked: { label: 'Reconocida', color: 'warning' },
  resolved: { label: 'Resuelta', color: 'success' },
}

const STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'open', label: 'Abiertas' },
  { key: 'acked', label: 'Reconocidas' },
  { key: 'resolved', label: 'Resueltas' },
]


const RULE_STATUS_FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'enabled', label: 'Activas' },
  { key: 'disabled', label: 'Inactivas' },
]

const RULE_SEVERITIES = [
  { key: 'warning', label: 'Warning' },
  { key: 'critical', label: 'Critical' },
]

const ALERTS_PAGE_SIZE = 8
const RULES_PAGE_SIZE = 6
const RULE_META_STORAGE_KEY = 'alert_rules_meta'

const loadRulesMeta = () => {
  try {
    const stored = localStorage.getItem(RULE_META_STORAGE_KEY)
    if (!stored) return {}
    const parsed = JSON.parse(stored)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    return {}
  }
}

const formatApiError = (payload, fallback) => {
  if (!payload || typeof payload !== 'object') return fallback
  if (payload.detail) return payload.detail
  const entries = Object.entries(payload)
  const messages = []
  entries.forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => messages.push(`${key}: ${item}`))
      return
    }
    if (typeof value === 'string') {
      messages.push(`${key}: ${value}`)
    }
  })
  return messages.length ? messages.join(' | ') : fallback
}

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed)
  }
  return fallback
}

const formatDate = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

const buildAlertTimeline = (alert) => {
  if (!alert) return []
  const entries = []
  const seen = new Set()
  const pushEntry = (label, time, note) => {
    if (!time) return
    if (seen.has(time)) return
    seen.add(time)
    entries.push({ label, time, note })
  }

  pushEntry('Abierta', alert.opened_at)
  pushEntry(
    'Reconocida',
    alert.acked_at,
    alert.acked_by ? `Usuario #${alert.acked_by}` : null,
  )
  pushEntry('Resuelta', alert.resolved_at)
  pushEntry('Actualizada', alert.updated_at)

  return entries
}

const toDateKey = (date) => {
  if (!(date instanceof Date)) return ''
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatMonthLabel = (date) => {
  if (!(date instanceof Date)) return ''
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const formatTargetLabel = (target) => {
  if (!target) return ''
  const name = target.name || `Target ${target.id || ''}`.trim()
  const address = target.address || target.host || ''
  return address ? `${name} - ${address}` : name
}

function AlertsPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('alerts')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [viewMode, setViewMode] = useState('alerts')
  const [statusFilter, setStatusFilter] = useState('open')
  const [searchValue, setSearchValue] = useState('')
  const [targetFilter, setTargetFilter] = useState('')
  const [selectedDates, setSelectedDates] = useState([])
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)
  const [actionType, setActionType] = useState('')
  const [alertPage, setAlertPage] = useState(1)
  const [activeAlert, setActiveAlert] = useState(null)
  const [resolveAlert, setResolveAlert] = useState(null)
  const [resolveForm, setResolveForm] = useState({
    reason: '',
    solution: '',
  })
  const [resolveError, setResolveError] = useState('')
  const [isResolving, setIsResolving] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [targets, setTargets] = useState([])
  const [targetsError, setTargetsError] = useState('')
  const [isLoadingTargets, setIsLoadingTargets] = useState(false)
  const [rules, setRules] = useState([])
  const [rulesError, setRulesError] = useState('')
  const [isLoadingRules, setIsLoadingRules] = useState(false)
  const [rulesFilter, setRulesFilter] = useState('all')
  const [rulesSearch, setRulesSearch] = useState('')
  const [rulesPage, setRulesPage] = useState(1)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    target: '',
    down_threshold: '3',
    up_threshold: '1',
    enabled: true,
    severity: 'warning',
    notifyEmail: false,
    notifyWebhook: false,
    notifySlack: false,
  })
  const [editRule, setEditRule] = useState(null)
  const [ruleFormError, setRuleFormError] = useState('')
  const [isSavingRule, setIsSavingRule] = useState(false)
  const [isUpdatingRule, setIsUpdatingRule] = useState(false)
  const [isTogglingRule, setIsTogglingRule] = useState(null)
  const [rulesMeta, setRulesMeta] = useState(loadRulesMeta)

  const targetsById = useMemo(() => {
    const map = new Map()
    targets.forEach((target) => {
      map.set(target.id, target)
    })
    return map
  }, [targets])

  const rulesById = useMemo(() => {
    const map = new Map()
    rules.forEach((rule) => {
      map.set(rule.id, rule)
    })
    return map
  }, [rules])

  const selectedDateSet = useMemo(
    () => new Set(selectedDates),
    [selectedDates],
  )

  const calendarDays = useMemo(() => {
    const base = new Date(calendarMonth)
    if (Number.isNaN(base.getTime())) return []
    const year = base.getFullYear()
    const month = base.getMonth()
    const firstDay = new Date(year, month, 1)
    const now = new Date()
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOffset = (firstDay.getDay() + 6) % 7
    const startDate = new Date(year, month, 1 - startOffset)
    const days = []
    const todayKey = toDateKey(new Date())
    for (let i = 0; i < 42; i += 1) {
      const current = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + i,
      )
      const key = toDateKey(current)
      days.push({
        key,
        date: current,
        day: current.getDate(),
        isCurrentMonth: current.getMonth() === month,
        isToday: key === todayKey,
        isFuture: current > todayDate,
      })
    }
    return days
  }, [calendarMonth])

  const updateRuleMeta = (ruleId, patch) => {
    if (!ruleId) return
    setRulesMeta((prev) => {
      const current = prev?.[ruleId] || {}
      const next = { ...prev, [ruleId]: { ...current, ...patch } }
      try {
        localStorage.setItem(RULE_META_STORAGE_KEY, JSON.stringify(next))
      } catch (err) {
        // Ignore storage errors to avoid blocking UI.
      }
      return next
    })
  }

  const summary = useMemo(() => {
    const counts = { open: 0, acked: 0, resolved: 0 }
    alerts.forEach((alert) => {
      if (alert?.status && counts[alert.status] !== undefined) {
        counts[alert.status] += 1
      }
    })
    return counts
  }, [alerts])

  const filteredAlerts = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    return alerts.filter((alert) => {
      const target = targetsById.get(alert.target)
      const rule = rulesById.get(alert.rule)
      if (targetFilter) {
        const targetId = Number(targetFilter)
        if (!Number.isNaN(targetId) && alert.target !== targetId) {
          return false
        }
      }
      if (selectedDateSet.size > 0) {
        const openedKey = toDateKey(new Date(alert.opened_at))
        if (!openedKey || !selectedDateSet.has(openedKey)) {
          return false
        }
      }
      if (!term) return true
      const haystack = [
        alert.summary,
        alert.details,
        alert.target,
        target?.name,
        target?.address,
        rule?.name,
        alert.rule,
        alert.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [
    alerts,
    rulesById,
    searchValue,
    selectedDateSet,
    targetFilter,
    targetsById,
  ])

  const filteredRules = useMemo(() => {
    const term = rulesSearch.trim().toLowerCase()
    const matchesStatus = (rule) => {
      if (rulesFilter === 'enabled') return rule.enabled
      if (rulesFilter === 'disabled') return !rule.enabled
      return true
    }
    return rules.filter((rule) => {
      if (!matchesStatus(rule)) return false
      if (!term) return true
      const target = targetsById.get(rule.target)
      const meta = rulesMeta?.[rule.id]
      const haystack = [
        rule.name,
        rule.target,
        target?.name,
        target?.address,
        meta?.severity,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [rules, rulesFilter, rulesMeta, rulesSearch, targetsById])

  const totalAlertPages = Math.max(
    1,
    Math.ceil(filteredAlerts.length / ALERTS_PAGE_SIZE),
  )
  const totalRulePages = Math.max(
    1,
    Math.ceil(filteredRules.length / RULES_PAGE_SIZE),
  )
  const currentAlertPage = Math.min(alertPage, totalAlertPages)
  const currentRulePage = Math.min(rulesPage, totalRulePages)
  const pagedAlerts = filteredAlerts.slice(
    (currentAlertPage - 1) * ALERTS_PAGE_SIZE,
    currentAlertPage * ALERTS_PAGE_SIZE,
  )
  const pagedRules = filteredRules.slice(
    (currentRulePage - 1) * RULES_PAGE_SIZE,
    currentRulePage * RULES_PAGE_SIZE,
  )

  const fetchAlerts = useCallback(async (filter = statusFilter) => {
    setIsLoading(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      setError('No hay sesion activa. Inicia sesion.')
      setAlerts([])
      setIsLoading(false)
      return
    }

    try {
      const query =
        filter && filter !== 'all'
          ? `?status=${encodeURIComponent(filter)}`
          : ''
      const response = await apiFetch(`${API_BASE_URL}/alerts/${query}`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.detail || 'No se pudo cargar alertas.')
        setAlerts([])
        return
      }
      setAlerts(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
      setAlerts([])
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  const fetchTargets = useCallback(async () => {
    setIsLoadingTargets(true)
    setTargetsError('')
    const token = getAuthToken()
    if (!token) {
      setTargetsError('No hay sesion activa. Inicia sesion.')
      setTargets([])
      setIsLoadingTargets(false)
      return
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/targets/`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setTargetsError(
          `HTTP ${response.status} - ${formatApiError(
            payload,
            'No se pudo cargar los targets.',
          )}`,
        )
        setTargets([])
        return
      }
      setTargets(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setTargetsError('No se pudo conectar con el servidor.')
      setTargets([])
    } finally {
      setIsLoadingTargets(false)
    }
  }, [])

  const fetchRules = useCallback(async () => {
    setIsLoadingRules(true)
    setRulesError('')
    const token = getAuthToken()
    if (!token) {
      setRulesError('No hay sesion activa. Inicia sesion.')
      setRules([])
      setIsLoadingRules(false)
      return
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/alert-rules/`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRulesError(
          `HTTP ${response.status} - ${formatApiError(
            payload,
            'No se pudo cargar reglas.',
          )}`,
        )
        setRules([])
        return
      }
      setRules(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setRulesError('No se pudo conectar con el servidor.')
      setRules([])
    } finally {
      setIsLoadingRules(false)
    }
  }, [])

  const updateRuleForm = (field, value) => {
    setRuleForm((prev) => ({ ...prev, [field]: value }))
  }

  const resetRuleForm = () => {
    setRuleForm({
      name: '',
      target: '',
      down_threshold: '3',
      up_threshold: '1',
      enabled: true,
      severity: 'warning',
      notifyEmail: false,
      notifyWebhook: false,
      notifySlack: false,
    })
    setEditRule(null)
    setRuleFormError('')
  }

  const handleCreateRule = async () => {
    const name = ruleForm.name.trim()
    const targetId = Number(ruleForm.target)
    setRuleFormError('')

    if (!name || !targetId) {
      setRuleFormError('Completa nombre y target.')
      return
    }

    const payload = {
      name,
      target: targetId,
      down_threshold: toPositiveInt(ruleForm.down_threshold, 3),
      up_threshold: toPositiveInt(ruleForm.up_threshold, 1),
      enabled: Boolean(ruleForm.enabled),
    }

    setIsSavingRule(true)
    try {
      const response = await apiFetch(`${API_BASE_URL}/alert-rules/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRuleFormError(
          `HTTP ${response.status} - ${formatApiError(
            data,
            'No se pudo crear la regla.',
          )}`,
        )
        return
      }
      setRules((prev) => [data, ...prev.filter((item) => item.id !== data.id)])
      updateRuleMeta(data.id, {
        severity: ruleForm.severity,
        notifyEmail: ruleForm.notifyEmail,
        notifyWebhook: ruleForm.notifyWebhook,
        notifySlack: ruleForm.notifySlack,
      })
      resetRuleForm()
    } catch (err) {
      setRuleFormError('No se pudo conectar con el servidor.')
    } finally {
      setIsSavingRule(false)
    }
  }

  const openEditRule = (rule) => {
    if (!rule) return
    const meta = rulesMeta?.[rule.id] || {}
    setEditRule(rule)
    setRuleForm({
      name: rule.name || '',
      target: String(rule.target || ''),
      down_threshold: String(rule.down_threshold ?? 3),
      up_threshold: String(rule.up_threshold ?? 1),
      enabled: Boolean(rule.enabled),
      severity: meta.severity || 'warning',
      notifyEmail: Boolean(meta.notifyEmail),
      notifyWebhook: Boolean(meta.notifyWebhook),
      notifySlack: Boolean(meta.notifySlack),
    })
    setRuleFormError('')
  }

  const handleUpdateRule = async () => {
    if (!editRule) return
    const name = ruleForm.name.trim()
    const targetId = Number(ruleForm.target)
    setRuleFormError('')

    if (!name || !targetId) {
      setRuleFormError('Completa nombre y target.')
      return
    }

    const payload = {
      name,
      target: targetId,
      down_threshold: toPositiveInt(ruleForm.down_threshold, 3),
      up_threshold: toPositiveInt(ruleForm.up_threshold, 1),
      enabled: Boolean(ruleForm.enabled),
    }

    setIsUpdatingRule(true)
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/alert-rules/${editRule.id}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRuleFormError(
          `HTTP ${response.status} - ${formatApiError(
            data,
            'No se pudo actualizar la regla.',
          )}`,
        )
        return
      }
      setRules((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)),
      )
      updateRuleMeta(data.id, {
        severity: ruleForm.severity,
        notifyEmail: ruleForm.notifyEmail,
        notifyWebhook: ruleForm.notifyWebhook,
        notifySlack: ruleForm.notifySlack,
      })
      resetRuleForm()
    } catch (err) {
      setRuleFormError('No se pudo conectar con el servidor.')
    } finally {
      setIsUpdatingRule(false)
    }
  }

  const handleToggleRule = async (ruleId, nextValue) => {
    if (!ruleId) return
    setIsTogglingRule(ruleId)
    setRulesError('')

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/alert-rules/${ruleId}/`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ enabled: nextValue }),
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setRulesError(
          `HTTP ${response.status} - ${formatApiError(
            data,
            'No se pudo actualizar la regla.',
          )}`,
        )
        return
      }
      setRules((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)),
      )
    } catch (err) {
      setRulesError('No se pudo conectar con el servidor.')
    } finally {
      setIsTogglingRule(null)
    }
  }

  const handleAlertAction = async (alertId, action) => {
    const token = getAuthToken()
    if (!token) {
      setError('No hay sesion activa. Inicia sesion.')
      return
    }
    setActionId(alertId)
    setActionType(action)
    setError('')

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/alerts/${alertId}/${action}/`,
        {
          method: 'POST',
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.detail || 'No se pudo actualizar la alerta.')
        return
      }
      setAlerts((prev) => {
        if (!payload?.id) return prev
        const matchesFilter =
          statusFilter === 'all' || payload.status === statusFilter
        if (!matchesFilter) {
          return prev.filter((item) => item.id !== alertId)
        }
        return prev.map((item) => (item.id === alertId ? payload : item))
      })
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setActionId(null)
      setActionType('')
    }
  }

  const openAlertDetail = (alert) => {
    setActiveAlert(alert)
  }

  const closeAlertDetail = () => {
    setActiveAlert(null)
  }

  const openResolveModal = (alert) => {
    if (!alert) return
    setResolveAlert(alert)
    setResolveForm({ reason: '', solution: '' })
    setResolveError('')
  }

  const closeResolveModal = () => {
    setResolveAlert(null)
    setResolveForm({ reason: '', solution: '' })
    setResolveError('')
    setIsResolving(false)
  }

  const handleResolveSubmit = async () => {
    if (!resolveAlert) return
    const reason = resolveForm.reason.trim()
    const solution = resolveForm.solution.trim()
    if (!reason || !solution) {
      setResolveError('Debes completar problema y solucion antes de justificar.')
      return
    }

    setResolveError('')
    setIsResolving(true)
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/alerts/${resolveAlert.id}/justify/`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resolution_reason: reason,
            resolution_solution: solution,
          }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setResolveError(payload.detail || 'No se pudo resolver la alerta.')
        return
      }
      setAlerts((prev) => {
        if (!payload?.id) return prev
        if (statusFilter !== 'all' && payload.status !== statusFilter) {
          return prev.filter((item) => item.id !== payload.id)
        }
        return prev.map((item) => (item.id === payload.id ? payload : item))
      })
      if (activeAlert?.id === payload.id) {
        setActiveAlert(payload)
      }
      closeResolveModal()
    } catch (err) {
      setResolveError('No se pudo conectar con el servidor.')
    } finally {
      setIsResolving(false)
    }
  }

  const toggleCalendarDay = (key) => {
    if (!key) return
    setSelectedDates((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key)
      }
      const next = [...prev, key]
      next.sort()
      return next
    })
  }

  const clearCalendarSelection = () => {
    setSelectedDates([])
  }

  const goToPrevMonth = () => {
    setCalendarMonth((prev) => {
      const date = new Date(prev)
      return new Date(date.getFullYear(), date.getMonth() - 1, 1)
    })
  }

  const goToNextMonth = () => {
    setCalendarMonth((prev) => {
      const date = new Date(prev)
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
      const now = new Date()
      const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      if (next > currentMonth) return prev
      return next
    })
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const toggleMobile = () => setIsMobileOpen((prev) => !prev)
  const handleSidebarEnter = () => {
    if (!isMobileOpen) {
      setIsCollapsed(false)
    }
  }

  const handleSidebarLeave = () => {
    if (!isMobileOpen) {
      setIsCollapsed(true)
    }
  }

  const handleNavSelect = (item) => {
    setActiveId(item.id)
    if (item.route) {
      navigate(item.route)
    }
  }

  const handleLogout = () => {
    clearAuthTokens()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  useEffect(() => {
    setAlertPage(1)
  }, [searchValue, statusFilter, targetFilter, selectedDates])

  useEffect(() => {
    setRulesPage(1)
  }, [rulesFilter, rulesSearch])

  const collapsedState = isMobileOpen ? false : isCollapsed
  const activeTarget = activeAlert
    ? targetsById.get(activeAlert.target)
    : null
  const activeRule = activeAlert ? rulesById.get(activeAlert.rule) : null
  const activeTimeline = buildAlertTimeline(activeAlert)
  const activeSeverity = activeAlert
    ? rulesMeta?.[activeAlert.rule]?.severity
    : null
  const activeSeverityColor =
    activeSeverity === 'critical' ? 'danger' : 'warning'
  const resolveTarget = resolveAlert
    ? targetsById.get(resolveAlert.target)
    : null
  const resolveRule = resolveAlert ? rulesById.get(resolveAlert.rule) : null

  return (
    <main
      className="dashboard"
      data-collapsed={collapsedState}
      data-mobile-open={isMobileOpen}
    >
      <div className="dashboard-shell">
        <aside
          className="dashboard-sidebar"
          onMouseEnter={handleSidebarEnter}
          onMouseLeave={handleSidebarLeave}
        >
          <div className="sidebar-header">
            <div className="sidebar-brand">
              <img src={gponLogo} alt="Gpon logo" className="sidebar-logo" />
              <div className="sidebar-brand-text">
                <p className="sidebar-title">NetPingMonitor</p>
                <p className="sidebar-subtitle">NOC Console</p>
              </div>
            </div>
          </div>

          <Divider className="sidebar-divider" />

          <nav className="sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === activeId
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`sidebar-link ${isActive ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => handleNavSelect(item)}
                >
                  <span className="sidebar-icon" aria-hidden="true">
                    <Icon className="sidebar-icon-svg" />
                  </span>
                  <span className="sidebar-label">
                    <span>{item.label}</span>
                    <small>{item.hint}</small>
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <Button
              size="sm"
              color="danger"
              variant="flat"
              className="sidebar-logout"
              startContent={
                <ArrowLeftOnRectangleIcon className="sidebar-logout-icon" />
              }
              onPress={handleLogout}
            >
              <span className="sidebar-logout-text">Cerrar sesion</span>
            </Button>
          </div>
        </aside>

        <section className="dashboard-content">
          <header className="dashboard-top">
            <div className="top-left">
              <Button
                isIconOnly
                variant="light"
                onPress={toggleMobile}
                className="mobile-toggle"
                aria-label="Abrir menu"
              >
                {isMobileOpen ? 'X' : '|||'}
              </Button>
              <div>
                <h1 className="dashboard-title">Alertas operativas</h1>
                <p className="dashboard-subtitle">
                  Gestiona eventos abiertos, reconocidos y resueltos.
                </p>
              </div>
            </div>
            <div className="top-actions">
              <Button
                variant="bordered"
                className="alerts-update"
                onPress={() => fetchAlerts(statusFilter)}
              >
                Actualizar
              </Button>
              <Button color="primary" variant="shadow">
                Exportar
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>

          <section className="alerts-view-tabs">
            <Tabs
              aria-label="Vista de alertas"
              variant="underlined"
              color="primary"
              selectedKey={viewMode}
              onSelectionChange={(key) => setViewMode(String(key))}
            >
              <Tab key="alerts" title="Alertas" />
              <Tab key="rules" title="Reglas" />
            </Tabs>
          </section>

          {viewMode === 'alerts' ? (
            <>
              <section className="alerts-summary">
                <Card className="alerts-summary-card">
                  <CardHeader className="alerts-summary-header">
                    <span>Abiertas</span>
                    <Chip size="sm" variant="flat" color="danger">
                      open
                    </Chip>
                  </CardHeader>
                  <CardBody className="alerts-summary-body">
                    <p>{summary.open}</p>
                  </CardBody>
                </Card>
                <Card className="alerts-summary-card">
                  <CardHeader className="alerts-summary-header">
                    <span>Reconocidas</span>
                    <Chip size="sm" variant="flat" color="warning">
                      acked
                    </Chip>
                  </CardHeader>
                  <CardBody className="alerts-summary-body">
                    <p>{summary.acked}</p>
                  </CardBody>
                </Card>
                <Card className="alerts-summary-card">
                  <CardHeader className="alerts-summary-header">
                    <span>Resueltas</span>
                    <Chip size="sm" variant="flat" color="success">
                      resolved
                    </Chip>
                  </CardHeader>
                  <CardBody className="alerts-summary-body">
                    <p>{summary.resolved}</p>
                  </CardBody>
                </Card>
              </section>

              <section className="alerts-controls">
                <Tabs
                  aria-label="Filtro de alertas"
                  variant="underlined"
                  color="primary"
                  selectedKey={statusFilter}
                  onSelectionChange={(key) => setStatusFilter(String(key))}
                  className="alerts-tabs"
                >
                  {STATUS_FILTERS.map((filter) => (
                    <Tab key={filter.key} title={filter.label} />
                  ))}
                </Tabs>
                <div className="alerts-controls-actions">
                  <Input
                    placeholder="Buscar por target, regla o detalle"
                    variant="bordered"
                    size="sm"
                    className="alerts-controls-input"
                    value={searchValue}
                    onValueChange={setSearchValue}
                  />
                  <Select
                    placeholder="Filtrar por target"
                    size="sm"
                    variant="bordered"
                    className="alerts-controls-select"
                    selectedKeys={targetFilter ? [targetFilter] : []}
                    onSelectionChange={(keys) =>
                      setTargetFilter(Array.from(keys)[0] || '')
                    }
                  >
                    {targets.map((target) => {
                      const label = formatTargetLabel(target)
                      return (
                        <SelectItem
                          key={String(target.id)}
                          value={String(target.id)}
                          textValue={label}
                        >
                          {label}
                        </SelectItem>
                      )
                    })}
                  </Select>
                  <Button
                    size="sm"
                    className="alerts-controls-calendar"
                    color="primary"
                    variant="shadow"
                    onPress={() => setIsCalendarOpen(true)}
                  >
                    Filtro por dias
                  </Button>
                </div>
              </section>

              <section className="alerts-list">
                <Card className="alerts-card">
                  <CardHeader className="alerts-card-header">
                    <div>
                      <p className="alerts-card-title">Listado de alertas</p>
                      <p className="alerts-card-subtitle">
                        Filtra por estado y actua en tiempo real.
                      </p>
                      <div className="alerts-filter-tags">
                        <Chip size="sm" variant="flat">
                          Target:{' '}
                          {formatTargetLabel(
                            targetFilter
                              ? targetsById.get(Number(targetFilter))
                              : null,
                          ) || 'Todos'}
                        </Chip>
                        <Chip size="sm" variant="flat">
                          Dias: {selectedDates.length || 'Todos'}
                        </Chip>
                      </div>
                    </div>
                    {isLoading ? (
                      <Chip size="sm" variant="flat">
                        Cargando
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="primary">
                        {filteredAlerts.length} eventos
                      </Chip>
                    )}
                  </CardHeader>
                  <CardBody className="alerts-card-body">
                    {error ? <p className="alerts-error">{error}</p> : null}
                    {!isLoading && !error && filteredAlerts.length === 0 ? (
                      <p className="alerts-empty">No hay alertas para mostrar.</p>
                    ) : null}
                    {pagedAlerts.map((alert) => {
                      const meta = STATUS_META[alert.status] || {
                        label: alert.status,
                        color: 'default',
                      }
                      const isActioning = actionId === alert.id
                      const target = targetsById.get(alert.target)
                      const rule = rulesById.get(alert.rule)
                      const severity = rulesMeta?.[alert.rule]?.severity
                      const severityColor =
                        severity === 'critical' ? 'danger' : 'warning'
                      const alertTitle =
                        rule?.name || alert.summary || `Alerta ${alert.id}`
                      const summaryLine =
                        rule?.name && alert.summary ? alert.summary : null
                      return (
                        <div
                          key={alert.id}
                          className="alerts-row"
                          data-status={alert.status}
                          data-severity={severity || undefined}
                        >
                          <div className="alerts-main">
                            <div>
                              <p className="alerts-title">{alertTitle}</p>
                              <p className="alerts-subtitle">
                                {target?.name || `Target #${alert.target}`} -{' '}
                                {rule?.name || `Regla #${alert.rule}`}
                              </p>
                            </div>
                            {summaryLine ? (
                              <p className="alerts-details">{summaryLine}</p>
                            ) : null}
                            {alert.details ? (
                              <p className="alerts-details">{alert.details}</p>
                            ) : null}
                            <div className="alerts-times">
                              <span>Abierta: {formatDate(alert.opened_at)}</span>
                              {alert.acked_at ? (
                                <span>Ack: {formatDate(alert.acked_at)}</span>
                              ) : null}
                              {alert.resolved_at ? (
                                <span>
                                  Resuelta: {formatDate(alert.resolved_at)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="alerts-side">
                            <div className="alerts-side-tags">
                              <Chip size="sm" variant="flat" color={meta.color}>
                                {meta.label}
                              </Chip>
                              {severity ? (
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={severityColor}
                                >
                                  {severity}
                                </Chip>
                              ) : null}
                            </div>
                            <div className="alerts-actions">
                              <Button
                                size="sm"
                                variant="bordered"
                                onPress={() => openAlertDetail(alert)}
                              >
                                Detalle
                              </Button>
                              {alert.status === 'open' ? (
                                <Button
                                  size="sm"
                                  variant="bordered"
                                  isLoading={isActioning && actionType === 'ack'}
                                  onPress={() => handleAlertAction(alert.id, 'ack')}
                                >
                                  Reconocer
                                </Button>
                              ) : null}
                              {alert.status === 'resolved' &&
                              (!alert.resolution_reason ||
                                !alert.resolution_solution) ? (
                                <Button
                                  size="sm"
                                  variant="bordered"
                                  onPress={() => openResolveModal(alert)}
                                >
                                  Justificar
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {filteredAlerts.length > 0 ? (
                      <div className="alerts-pagination">
                        <Button
                          size="sm"
                          variant="bordered"
                          isDisabled={currentAlertPage <= 1}
                          onPress={() =>
                            setAlertPage((prev) => Math.max(1, prev - 1))
                          }
                        >
                          Anterior
                        </Button>
                        <span>
                          Pagina {currentAlertPage} de {totalAlertPages}
                        </span>
                        <Button
                          size="sm"
                          variant="bordered"
                          isDisabled={currentAlertPage >= totalAlertPages}
                          onPress={() =>
                            setAlertPage((prev) =>
                              Math.min(totalAlertPages, prev + 1),
                            )
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </section>
            </>
          ) : (
            <section className="alerts-rules">
              <div className="alerts-rules-grid">
                <Card className="alerts-rules-card">
                  <CardHeader className="alerts-card-header">
                    <div>
                      <p className="alerts-card-title">
                        {editRule ? 'Editar regla' : 'Nueva regla'}
                      </p>
                      <p className="alerts-card-subtitle">
                        Define umbrales por target y activa/desactiva alertas.
                      </p>
                    </div>
                    <Chip size="sm" variant="flat" color="primary">
                      {editRule ? 'Edicion' : 'Registro'}
                    </Chip>
                  </CardHeader>
                  <CardBody className="alerts-card-body">
                    <div className="alerts-rule-form">
                      <Input
                        label="Nombre"
                        placeholder="Caida OLT Plaza"
                        value={ruleForm.name}
                        onValueChange={(value) => updateRuleForm('name', value)}
                      />
                      <Select
                        label="Target"
                        placeholder="Selecciona un target"
                        isDisabled={isLoadingTargets}
                        selectedKeys={ruleForm.target ? [ruleForm.target] : []}
                        onSelectionChange={(keys) =>
                          updateRuleForm(
                            'target',
                            Array.from(keys)[0] || '',
                          )
                        }
                      >
                        {targets.map((target) => (
                          <SelectItem
                            key={String(target.id)}
                            value={String(target.id)}
                          >
                            {target.name} - {target.address}
                          </SelectItem>
                        ))}
                      </Select>
                      <div className="alerts-rule-form-row">
                        <Input
                          label="DOWN threshold"
                          type="number"
                          min="1"
                          value={ruleForm.down_threshold}
                          onValueChange={(value) =>
                            updateRuleForm('down_threshold', value)
                          }
                        />
                        <Input
                          label="UP threshold"
                          type="number"
                          min="1"
                          value={ruleForm.up_threshold}
                          onValueChange={(value) =>
                            updateRuleForm('up_threshold', value)
                          }
                        />
                      </div>
                      <div className="alerts-rule-form-row">
                        <Select
                          label="Severidad (opcional)"
                          selectedKeys={[ruleForm.severity]}
                          onSelectionChange={(keys) =>
                            updateRuleForm(
                              'severity',
                              Array.from(keys)[0] || 'warning',
                            )
                          }
                        >
                          {RULE_SEVERITIES.map((severity) => (
                            <SelectItem
                              key={severity.key}
                              value={severity.key}
                            >
                              {severity.label}
                            </SelectItem>
                          ))}
                        </Select>
                        <Switch
                          color="primary"
                          isSelected={ruleForm.enabled}
                          onValueChange={(value) =>
                            updateRuleForm('enabled', value)
                          }
                        >
                          Regla activa
                        </Switch>
                      </div>
                      <div className="alerts-rule-form-block">
                        <p className="alerts-rule-label">
                          Notificaciones (opcional)
                        </p>
                        <div className="alerts-rule-notify">
                          <Switch
                            size="sm"
                            color="primary"
                            isSelected={ruleForm.notifyEmail}
                            onValueChange={(value) =>
                              updateRuleForm('notifyEmail', value)
                            }
                          >
                            Email
                          </Switch>
                          <Switch
                            size="sm"
                            color="primary"
                            isSelected={ruleForm.notifyWebhook}
                            onValueChange={(value) =>
                              updateRuleForm('notifyWebhook', value)
                            }
                          >
                            Webhook
                          </Switch>
                          <Switch
                            size="sm"
                            color="primary"
                            isSelected={ruleForm.notifySlack}
                            onValueChange={(value) =>
                              updateRuleForm('notifySlack', value)
                            }
                          >
                            Slack
                          </Switch>
                        </div>
                      </div>
                      {ruleFormError ? (
                        <p className="alerts-error">{ruleFormError}</p>
                      ) : null}
                      {targetsError ? (
                        <p className="alerts-error">{targetsError}</p>
                      ) : null}
                      <div className="alerts-rule-actions">
                        {editRule ? (
                          <>
                            <Button
                              color="primary"
                              isLoading={isUpdatingRule}
                              onPress={handleUpdateRule}
                            >
                              Guardar cambios
                            </Button>
                            <Button variant="bordered" onPress={resetRuleForm}>
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <Button
                            color="primary"
                            isLoading={isSavingRule}
                            onPress={handleCreateRule}
                          >
                            Crear regla
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="alerts-rules-card">
                  <CardHeader className="alerts-card-header">
                    <div>
                      <p className="alerts-card-title">Reglas registradas</p>
                      <p className="alerts-card-subtitle">
                        Administra umbrales y estado por target.
                      </p>
                    </div>
                    {isLoadingRules ? (
                      <Chip size="sm" variant="flat">
                        Cargando
                      </Chip>
                    ) : (
                      <Chip size="sm" variant="flat" color="primary">
                        {filteredRules.length} reglas
                      </Chip>
                    )}
                  </CardHeader>
                  <CardBody className="alerts-card-body">
                    <div className="alerts-rules-controls">
                      <Tabs
                        aria-label="Filtro de reglas"
                        variant="underlined"
                        color="primary"
                        selectedKey={rulesFilter}
                        onSelectionChange={(key) => setRulesFilter(String(key))}
                      >
                        {RULE_STATUS_FILTERS.map((filter) => (
                          <Tab key={filter.key} title={filter.label} />
                        ))}
                      </Tabs>
                      <Input
                        placeholder="Buscar por regla o target"
                        size="sm"
                        variant="bordered"
                        value={rulesSearch}
                        onValueChange={setRulesSearch}
                      />
                    </div>
                    {rulesError ? <p className="alerts-error">{rulesError}</p> : null}
                    {!isLoadingRules && filteredRules.length === 0 ? (
                      <p className="alerts-empty">
                        No hay reglas activas. Crea la primera regla arriba.
                      </p>
                    ) : null}
                    <div className="alerts-rules-list">
                      {pagedRules.map((rule) => {
                        const target = targetsById.get(rule.target)
                        const meta = rulesMeta?.[rule.id] || {}
                        const severity = meta.severity
                        const severityColor =
                          severity === 'critical' ? 'danger' : 'warning'
                        return (
                          <div key={rule.id} className="alerts-rule-row">
                            <div>
                              <p className="alerts-title">{rule.name}</p>
                              <p className="alerts-subtitle">
                                {target?.name || `Target #${rule.target}`} -
                                DOWN {rule.down_threshold} / UP{' '}
                                {rule.up_threshold}
                              </p>
                            </div>
                            <div className="alerts-rule-side">
                              <div className="alerts-rule-tags">
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={rule.enabled ? 'success' : 'default'}
                                >
                                  {rule.enabled ? 'Activa' : 'Inactiva'}
                                </Chip>
                                {severity ? (
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={severityColor}
                                  >
                                    {severity}
                                  </Chip>
                                ) : null}
                              </div>
                              <div className="alerts-rule-actions">
                                <Switch
                                  size="sm"
                                  color="primary"
                                  isSelected={rule.enabled}
                                  isDisabled={isTogglingRule === rule.id}
                                  onValueChange={(value) =>
                                    handleToggleRule(rule.id, value)
                                  }
                                >
                                  {rule.enabled ? 'Activa' : 'Pausada'}
                                </Switch>
                                <Button
                                  size="sm"
                                  variant="bordered"
                                  onPress={() => openEditRule(rule)}
                                >
                                  Editar
                                </Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {filteredRules.length > 0 ? (
                      <div className="alerts-pagination">
                        <Button
                          size="sm"
                          variant="bordered"
                          isDisabled={currentRulePage <= 1}
                          onPress={() =>
                            setRulesPage((prev) => Math.max(1, prev - 1))
                          }
                        >
                          Anterior
                        </Button>
                        <span>
                          Pagina {currentRulePage} de {totalRulePages}
                        </span>
                        <Button
                          size="sm"
                          variant="bordered"
                          isDisabled={currentRulePage >= totalRulePages}
                          onPress={() =>
                            setRulesPage((prev) =>
                              Math.min(totalRulePages, prev + 1),
                            )
                          }
                        >
                          Siguiente
                        </Button>
                      </div>
                    ) : null}
                  </CardBody>
                </Card>
              </div>
            </section>
          )}
        </section>
      </div>
      <button
        type="button"
        className="dashboard-overlay"
        onClick={() => setIsMobileOpen(false)}
        aria-hidden={!isMobileOpen}
      />
      {activeAlert ? (
        <div className="alerts-modal-backdrop" onClick={closeAlertDetail}>
          <div
            className="alerts-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="alerts-modal-header">
              <div>
                <p className="alerts-modal-title">
                  {activeTarget?.name || `Target #${activeAlert.target}`}
                </p>
                <p className="alerts-modal-subtitle">
                  {activeTarget?.address || 'Sin direccion'} -{' '}
                  {activeRule?.name || `Regla #${activeAlert.rule}`}
                </p>
              </div>
              <div className="alerts-modal-actions">
                {activeAlert.status ? (
                  <Chip
                    size="sm"
                    variant="flat"
                    color={STATUS_META[activeAlert.status]?.color || 'default'}
                  >
                    {STATUS_META[activeAlert.status]?.label ||
                      activeAlert.status}
                  </Chip>
                ) : null}
                <Button
                  isIconOnly
                  variant="light"
                  onPress={closeAlertDetail}
                  aria-label="Cerrar"
                >
                  X
                </Button>
              </div>
            </div>
            <Divider />
            <div className="alerts-modal-body">
              <div className="alerts-detail-grid">
                <div className="alerts-detail-block">
                  <p className="alerts-detail-title">Resumen</p>
                  <p className="alerts-detail-text">
                    {activeAlert.summary || 'Sin resumen registrado.'}
                  </p>
                  {activeAlert.details ? (
                    <p className="alerts-detail-text">{activeAlert.details}</p>
                  ) : null}
                  <div className="alerts-detail-tags">
                    {activeSeverity ? (
                      <Chip size="sm" variant="flat" color={activeSeverityColor}>
                        {activeSeverity}
                      </Chip>
                    ) : null}
                    <Chip size="sm" variant="flat">
                      DOWN {activeRule?.down_threshold ?? '-'} / UP{' '}
                      {activeRule?.up_threshold ?? '-'}
                    </Chip>
                  </div>
                </div>
                <div className="alerts-detail-block">
                  <p className="alerts-detail-title">Resolucion</p>
                  <p className="alerts-detail-text">
                    Problema:{' '}
                    {activeAlert.resolution_reason ||
                      'Pendiente de justificacion.'}
                  </p>
                  <p className="alerts-detail-text">
                    Solucion:{' '}
                    {activeAlert.resolution_solution ||
                      'Pendiente de justificacion.'}
                  </p>
                </div>
                <div className="alerts-detail-block">
                  <p className="alerts-detail-title">Historial</p>
                  <div className="alerts-detail-timeline">
                    {activeTimeline.map((entry) => (
                      <div key={`${entry.label}-${entry.time}`}>
                        <p className="alerts-detail-label">{entry.label}</p>
                        <p className="alerts-detail-text">
                          {formatDate(entry.time)}
                          {entry.note ? ` (${entry.note})` : ''}
                        </p>
                      </div>
                    ))}
                    {activeTimeline.length === 0 ? (
                      <p className="alerts-empty">Sin historial registrado.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Modal
        isOpen={isCalendarOpen}
        onOpenChange={(open) => {
          if (!open) setIsCalendarOpen(false)
        }}
        size="lg"
        className="alerts-calendar-modal"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="alerts-modal-header">
                <div>
                  <p className="alerts-modal-title">Filtro por dias</p>
                  <p className="alerts-modal-subtitle">
                    Selecciona uno o varios dias para filtrar alertas.
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="alerts-modal-body">
                <div className="alerts-filter-panel">
                  <Card className="alerts-filter-card">
                    <div className="alerts-filter-header">
                      <div>
                        <p className="alerts-card-title">Calendario</p>
                        <p className="alerts-card-subtitle">
                          Selecciona dias especificos para filtrar alertas.
                        </p>
                      </div>
                      <div className="alerts-filter-actions alerts-filter-actions-compact">
                        <Button size="sm" variant="bordered" onPress={goToPrevMonth}>
                          Anterior
                        </Button>
                        <Button size="sm" variant="bordered" onPress={goToCurrentMonth}>
                          Hoy
                        </Button>
                        <Button size="sm" variant="bordered" onPress={goToNextMonth}>
                          Siguiente
                        </Button>
                      </div>
                    </div>
                    <div className="alerts-filter-body">
                      <div className="alerts-calendar-header">
                        <span>{formatMonthLabel(calendarMonth)}</span>
                        <div className="alerts-calendar-meta">
                          <Chip size="sm" variant="flat">
                            {selectedDates.length} dias
                          </Chip>
                        </div>
                      </div>
                      <div className="alerts-calendar-weekdays">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day) => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                      <div className="alerts-calendar-grid">
                        {calendarDays.map((day) => {
                          const isSelected = selectedDateSet.has(day.key)
                          const isDisabled = day.isFuture
                          const dayClassName = [
                            'alerts-calendar-day',
                            !day.isCurrentMonth ? 'is-muted' : '',
                            day.isToday ? 'is-today' : '',
                            isSelected ? 'is-selected' : '',
                            isDisabled ? 'is-disabled' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')
                          return (
                            <button
                              key={day.key}
                              type="button"
                              className={dayClassName}
                              onClick={() => toggleCalendarDay(day.key)}
                              disabled={isDisabled}
                            >
                              {day.day}
                            </button>
                          )
                        })}
                      </div>
                      <div className="alerts-filter-actions">
                        <Button size="sm" variant="bordered" onPress={clearCalendarSelection}>
                          Limpiar seleccion
                        </Button>
                        <Button color="primary" size="sm" onPress={() => setIsCalendarOpen(false)}>
                          Aplicar filtro
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
      <Modal
        isOpen={Boolean(resolveAlert)}
        onOpenChange={(open) => {
          if (!open) closeResolveModal()
        }}
        size="lg"
        className="alerts-resolve-modal"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="alerts-modal-header">
                <div>
                  <p className="alerts-modal-title">Justificar alerta</p>
                  <p className="alerts-modal-subtitle">
                    {resolveTarget?.name || `Target #${resolveAlert?.target}`} -{' '}
                    {resolveRule?.name || `Regla #${resolveAlert?.rule}`}
                  </p>
                </div>
              </ModalHeader>
              <ModalBody className="alerts-modal-body">
                <div className="alerts-resolve-form">
                  <Input
                    label="Problema detectado"
                    placeholder="Ej: corte de energia en PC Cesar"
                    value={resolveForm.reason}
                    onValueChange={(value) =>
                      setResolveForm((prev) => ({ ...prev, reason: value }))
                    }
                  />
                  <Textarea
                    label="Solucion aplicada"
                    placeholder="Describe como se resolvio la alerta"
                    minRows={3}
                    value={resolveForm.solution}
                    onValueChange={(value) =>
                      setResolveForm((prev) => ({ ...prev, solution: value }))
                    }
                  />
                  {resolveError ? (
                    <p className="alerts-error">{resolveError}</p>
                  ) : null}
                  <div className="alerts-rule-actions">
                    <Button variant="bordered" onPress={closeResolveModal}>
                      Cancelar
                    </Button>
                    <Button
                      color="primary"
                      isLoading={isResolving}
                      onPress={handleResolveSubmit}
                    >
                      Guardar justificacion
                    </Button>
                  </div>
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
    </main>
  )
}

export default AlertsPage
