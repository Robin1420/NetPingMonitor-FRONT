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
} from '@heroui/react'
import {
  ArrowLeftOnRectangleIcon,
  ArrowTrendingDownIcon,
  BellAlertIcon,
  BoltIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import gponLogo from '../../assets/img/Gponlogo.jpg'
import Sparkline from '../../components/Sparkline'
import {
  API_BASE_URL,
  apiFetch,
  clearAuthTokens,
  getAuthToken,
} from '../../utils/apiClient'
import './Dashboard.css'

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
  UP: { label: 'UP', color: 'success' },
  DOWN: { label: 'DOWN', color: 'danger' },
  UNKNOWN: { label: 'Sin dato', color: 'default' },
}

const ALERT_STATUS_META = {
  open: { label: 'Abierta', color: 'danger' },
  acked: { label: 'Reconocida', color: 'warning' },
  resolved: { label: 'Resuelta', color: 'success' },
}

const RULE_META_STORAGE_KEY = 'alert_rules_meta'

const POLL_MS = 15000

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

function DashboardPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('overview')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [isChartOpen, setIsChartOpen] = useState(false)
  const [activeChart, setActiveChart] = useState(null)
  const [activeAlerts, setActiveAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [alertsError, setAlertsError] = useState('')
  const [alertsUpdated, setAlertsUpdated] = useState(null)
  const [alertRules, setAlertRules] = useState([])
  const [rulesMeta, setRulesMeta] = useState(loadRulesMeta)

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

  const openChart = (payload) => {
    setActiveChart(payload)
    setIsChartOpen(true)
  }

  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      setError('No hay sesion activa. Inicia sesion.')
      setRows([])
      setIsLoading(false)
      return
    }

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/targets/status/?include_history=1&points=60`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.detail || 'No se pudo cargar el estado.')
        setRows([])
        return
      }
      const results = Array.isArray(payload?.results) ? payload.results : []
      setRows(results)
      setLastUpdated(new Date())
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const fetchActiveAlerts = useCallback(async () => {
    setAlertsLoading(true)
    setAlertsError('')
    setRulesMeta(loadRulesMeta())
    const token = getAuthToken()
    if (!token) {
      setAlertsError('No hay sesion activa. Inicia sesion.')
      setActiveAlerts([])
      setAlertsLoading(false)
      return
    }

    try {
      const [openResponse, ackedResponse] = await Promise.all([
        apiFetch(`${API_BASE_URL}/alerts/?status=open`),
        apiFetch(`${API_BASE_URL}/alerts/?status=acked`),
      ])

      const openPayload = openResponse.ok
        ? await openResponse.json().catch(() => [])
        : []
      const ackedPayload = ackedResponse.ok
        ? await ackedResponse.json().catch(() => [])
        : []

      if (!openResponse.ok || !ackedResponse.ok) {
        setAlertsError('No se pudo cargar alertas activas.')
      }

      const combined = [...openPayload, ...ackedPayload].filter(Boolean)
      const unique = []
      const seen = new Set()
      combined.forEach((alert) => {
        if (!alert?.id || seen.has(alert.id)) return
        seen.add(alert.id)
        unique.push(alert)
      })
      setActiveAlerts(unique)
      setAlertsUpdated(new Date())
    } catch (err) {
      setAlertsError('No se pudo conectar con el servidor.')
      setActiveAlerts([])
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  const fetchAlertRules = useCallback(async () => {
    const token = getAuthToken()
    if (!token) {
      setAlertRules([])
      return
    }

    try {
      const response = await apiFetch(`${API_BASE_URL}/alert-rules/`)
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        setAlertRules([])
        return
      }
      setAlertRules(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setAlertRules([])
    }
  }, [])

  const filteredRows = useMemo(() => {
    const term = searchValue.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((row) => {
      const target = row?.target || {}
      const haystack = [target.name, target.address, target.target_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [rows, searchValue])

  const targetsById = useMemo(() => {
    const map = new Map()
    rows.forEach((row) => {
      if (row?.target?.id) {
        map.set(row.target.id, row.target)
      }
    })
    return map
  }, [rows])

  const alertRulesById = useMemo(() => {
    const map = new Map()
    alertRules.forEach((rule) => {
      map.set(rule.id, rule)
    })
    return map
  }, [alertRules])

  useEffect(() => {
    fetchStatus()
    fetchActiveAlerts()
    fetchAlertRules()
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchStatus()
        fetchActiveAlerts()
        fetchAlertRules()
      }
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [fetchStatus, fetchActiveAlerts, fetchAlertRules])

  const formatDateTime = (value) => {
    if (!value) return 'Sin datos'
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return 'Sin datos'
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(parsed)
  }

  const collapsedState = isMobileOpen ? false : isCollapsed

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
                <h1 className="dashboard-title">Resumen operativo</h1>
                <p className="dashboard-subtitle">
                  Vista consolidada de disponibilidad y alertas.
                </p>
              </div>
            </div>
            <div className="top-actions">
              <Input
                placeholder="Buscar target..."
                variant="bordered"
                size="sm"
                className="dashboard-search"
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <Button
                color="primary"
                variant="shadow"
                onPress={fetchStatus}
                isLoading={isLoading}
              >
                Actualizar
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>

          <section className="dashboard-alerts-section">
            <Card className="dashboard-alerts-card">
              <CardHeader className="dashboard-alerts-header">
                <div>
                  <p className="dashboard-alerts-title">Alertas activas</p>
                  <p className="dashboard-alerts-subtitle">
                    Permanecen visibles hasta que se resuelven.
                  </p>
                  <p className="dashboard-alerts-updated">
                    Ultima actualizacion: {formatDateTime(alertsUpdated)}
                  </p>
                </div>
                {alertsLoading ? (
                  <Chip size="sm" variant="flat">
                    Cargando
                  </Chip>
                ) : (
                  <Chip size="sm" variant="flat" color="danger">
                    {activeAlerts.length} activas
                  </Chip>
                )}
              </CardHeader>
              <CardBody className="dashboard-alerts-body">
                {alertsError ? (
                  <p className="dashboard-error">{alertsError}</p>
                ) : null}
                {!alertsLoading && !alertsError && activeAlerts.length === 0 ? (
                  <p className="dashboard-empty">
                    No hay alertas abiertas ni reconocidas.
                  </p>
                ) : null}
                <div className="dashboard-alerts-list">
                  {activeAlerts.map((alert) => {
                    const target = targetsById.get(alert.target)
                    const rule = alertRulesById.get(alert.rule)
                    const meta =
                      ALERT_STATUS_META[alert.status] ||
                      ALERT_STATUS_META.open
                    const severity =
                      rulesMeta?.[alert.rule]?.severity || 'warning'
                    const severityColor =
                      severity === 'critical' ? 'danger' : 'warning'
                    const alertTitle =
                      rule?.name ||
                      alert.summary ||
                      `Alerta ${alert.id} en ${
                        target?.name || `Target ${alert.target}`
                      }`
                    const summaryLine =
                      rule?.name && alert.summary ? alert.summary : null
                    return (
                      <div
                        key={alert.id}
                        className="dashboard-alert"
                        data-status={alert.status}
                        data-severity={severity}
                      >
                        <div className="dashboard-alert-main">
                          <div className="dashboard-alert-title">
                            <BellAlertIcon
                              className="dashboard-alert-icon"
                              aria-hidden="true"
                            />
                            <div>
                              <p>{alertTitle}</p>
                              <span>
                                {target?.address || `Target #${alert.target}`}{' '}
                                · {rule?.name || `Regla #${alert.rule}`}
                              </span>
                            </div>
                          </div>
                          {summaryLine ? (
                            <p className="dashboard-alert-details">
                              {summaryLine}
                            </p>
                          ) : null}
                          {alert.details ? (
                            <p className="dashboard-alert-details">
                              {alert.details}
                            </p>
                          ) : null}
                        </div>
                        <div className="dashboard-alert-side">
                          <div className="dashboard-alert-tags">
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
                          <span className="dashboard-alert-time">
                            {formatDateTime(alert.opened_at)}
                          </span>
                          <Button
                            size="sm"
                            variant="bordered"
                            onPress={() => navigate('/alerts')}
                          >
                            Ver detalle
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          </section>

          <section className="dashboard-table-section">
            <Card className="dashboard-table-card">
              <CardHeader className="dashboard-table-header">
                <div>
                  <p className="dashboard-table-title">
                    Monitoreo en tiempo real
                  </p>
                  <p className="dashboard-table-subtitle">
                    Latencia y estado de los ultimos 60 pings por target.
                  </p>
                  <p className="dashboard-table-updated">
                    Ultima actualizacion: {formatDateTime(lastUpdated)}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="dashboard-table-body">
                {error ? <p className="dashboard-error">{error}</p> : null}
                {!isLoading && !error && filteredRows.length === 0 ? (
                  <p className="dashboard-empty">No hay datos para mostrar.</p>
                ) : null}
                <div className="dashboard-cards">
                  {filteredRows.map((row) => {
                    const target = row?.target || {}
                    const status = row?.current_status || {}
                    const sparklinePoints = row?.sparkline || []
                    const lastPoint =
                      sparklinePoints.length > 0
                        ? sparklinePoints[sparklinePoints.length - 1]
                        : null
                    const statusValue =
                      lastPoint?.s || status.status || 'UNKNOWN'
                    const statusMeta =
                      STATUS_META[statusValue] || STATUS_META.UNKNOWN
                    const latencyValue =
                      lastPoint?.l ?? status.last_latency_ms ?? null
                    const lossValue =
                      lastPoint?.p ?? status.last_packet_loss_percent ?? null
                    const latency =
                      latencyValue !== null && latencyValue !== undefined
                        ? `${latencyValue} ms`
                        : '--'
                    const loss =
                      lossValue !== null && lossValue !== undefined
                        ? `${lossValue}%`
                        : '--'
                    const interval = target.check_interval_seconds
                      ? `${target.check_interval_seconds}s`
                      : '--'
                    return (
                      <Card key={target.id} className="dashboard-card-item">
                        <CardHeader className="dashboard-card-header">
                          <div className="dashboard-card-title">
                            <p>{target.name || `Target ${target.id}`}</p>
                            <span>
                              {target.address} - {target.target_type}
                            </span>
                          </div>
                          <Chip
                            size="sm"
                            variant="flat"
                            color={statusMeta.color}
                          >
                            {statusMeta.label}
                          </Chip>
                        </CardHeader>
                        <CardBody className="dashboard-card-body">
                          <div className="dashboard-card-metrics">
                            <span className="dashboard-metric">
                              <BoltIcon
                                className="dashboard-metric-icon"
                                aria-hidden="true"
                              />
                              {latency}
                            </span>
                            <span className="dashboard-metric">
                              <ArrowTrendingDownIcon
                                className="dashboard-metric-icon"
                                aria-hidden="true"
                              />
                              {loss}
                            </span>
                            <span className="dashboard-metric">
                              <ClockIcon
                                className="dashboard-metric-icon"
                                aria-hidden="true"
                              />
                              {interval}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="dashboard-card-sparkline"
                            onClick={() =>
                              openChart({
                                target,
                                statusMeta,
                                latency,
                                loss,
                                interval,
                                sparklinePoints,
                              })
                            }
                          >
                            <Sparkline
                              points={sparklinePoints}
                              width={220}
                              height={64}
                              intervalSeconds={target.check_interval_seconds}
                              labelEveryMinutes={1}
                              yLabelFontSize={4}
                              xLabelFontSize={3}
                              paddingLeft={20}
                              labelHeight={12}
                              showYAxisLabels
                              showSeconds={false}
                            />
                          </button>
                        </CardBody>
                      </Card>
                    )
                  })}
                </div>
              </CardBody>
            </Card>
          </section>
        </section>
      </div>
      <Modal
        isOpen={isChartOpen}
        onOpenChange={setIsChartOpen}
        size="lg"
        className="dashboard-chart-modal"
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="dashboard-chart-header">
                <div className="dashboard-chart-title">
                  <p>
                    {activeChart?.target?.name
                      ? `${activeChart.target.name}`
                      : 'Detalle de ping'}
                  </p>
                  <span>
                    {activeChart?.target?.address} -{' '}
                    {activeChart?.target?.target_type}
                  </span>
                </div>
              </ModalHeader>
              <ModalBody className="dashboard-chart-body">
                <div className="dashboard-chart-metrics">
                  <div className="dashboard-chart-metrics-left">
                    <span className="dashboard-metric">
                      <BoltIcon
                        className="dashboard-metric-icon"
                        aria-hidden="true"
                      />
                      {activeChart?.latency || '--'}
                    </span>
                    <span className="dashboard-metric">
                      <ArrowTrendingDownIcon
                        className="dashboard-metric-icon"
                        aria-hidden="true"
                      />
                      {activeChart?.loss || '--'}
                    </span>
                    <span className="dashboard-metric">
                      <ClockIcon
                        className="dashboard-metric-icon"
                        aria-hidden="true"
                      />
                      {activeChart?.interval || '--'}
                    </span>
                  </div>
                  {activeChart?.statusMeta ? (
                    <Chip
                      size="sm"
                      variant="flat"
                      color={activeChart.statusMeta.color}
                      className="dashboard-chart-status"
                    >
                      {activeChart.statusMeta.label}
                    </Chip>
                  ) : null}
                </div>
                <div className="dashboard-chart-graph">
                  <Sparkline
                    points={activeChart?.sparklinePoints || []}
                    width={1400}
                    height={520}
                    intervalSeconds={
                      activeChart?.target?.check_interval_seconds
                    }
                    labelEveryMinutes={1}
                    showAllLabels
                    yLabelFontSize={12}
                    xLabelFontSize={11}
                    paddingLeft={72}
                    labelHeight={40}
                    showYAxisLabels
                    showSeconds
                    enableTooltip
                  />
                </div>
              </ModalBody>
            </>
          )}
        </ModalContent>
      </Modal>
      <button
        type="button"
        className="dashboard-overlay"
        onClick={() => setIsMobileOpen(false)}
        aria-hidden={!isMobileOpen}
      />
    </main>
  )
}

export default DashboardPage
