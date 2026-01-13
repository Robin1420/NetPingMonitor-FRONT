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
  Tab,
  Tabs,
} from '@heroui/react'
import {
  BellAlertIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  Squares2X2Icon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import gponLogo from '../../assets/img/Gponlogo.jpg'
import '../Dashboard/Dashboard.css'
import './Alerts.css'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'
).replace(/\/$/, '')

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

const getAuthToken = () =>
  localStorage.getItem('access_token') ||
  sessionStorage.getItem('access_token') ||
  ''

const formatDate = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function AlertsPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('alerts')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('open')
  const [searchValue, setSearchValue] = useState('')
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [actionId, setActionId] = useState(null)
  const [actionType, setActionType] = useState('')

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
    if (!term) return alerts
    return alerts.filter((alert) => {
      const haystack = [
        alert.summary,
        alert.details,
        alert.target,
        alert.rule,
        alert.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(term)
    })
  }, [alerts, searchValue])

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
      const response = await fetch(`${API_BASE_URL}/alerts/${query}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
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
      const response = await fetch(
        `${API_BASE_URL}/alerts/${alertId}/${action}/`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
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

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

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
            <Chip color="primary" variant="flat">
              API activa
            </Chip>
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
              <Button variant="bordered" onPress={() => fetchAlerts(statusFilter)}>
                Actualizar
              </Button>
              <Button color="primary" variant="shadow">
                Exportar
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>

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
                value={searchValue}
                onValueChange={setSearchValue}
              />
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
                {filteredAlerts.map((alert) => {
                  const meta = STATUS_META[alert.status] || {
                    label: alert.status,
                    color: 'default',
                  }
                  const isActioning = actionId === alert.id
                  return (
                    <div key={alert.id} className="alerts-row">
                      <div className="alerts-main">
                        <div>
                          <p className="alerts-title">
                            {alert.summary || `Alerta ${alert.id}`}
                          </p>
                          <p className="alerts-subtitle">
                            Target #{alert.target} · Regla #{alert.rule}
                          </p>
                        </div>
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
                        <Chip size="sm" variant="flat" color={meta.color}>
                          {meta.label}
                        </Chip>
                        <div className="alerts-actions">
                          {alert.status === 'open' ? (
                            <>
                              <Button
                                size="sm"
                                variant="bordered"
                                isLoading={isActioning && actionType === 'ack'}
                                onPress={() =>
                                  handleAlertAction(alert.id, 'ack')
                                }
                              >
                                Reconocer
                              </Button>
                              <Button
                                size="sm"
                                color="primary"
                                variant="shadow"
                                isLoading={isActioning && actionType === 'resolve'}
                                onPress={() =>
                                  handleAlertAction(alert.id, 'resolve')
                                }
                              >
                                Resolver
                              </Button>
                            </>
                          ) : null}
                          {alert.status === 'acked' ? (
                            <Button
                              size="sm"
                              color="primary"
                              variant="shadow"
                              isLoading={isActioning && actionType === 'resolve'}
                              onPress={() =>
                                handleAlertAction(alert.id, 'resolve')
                              }
                            >
                              Resolver
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </CardBody>
            </Card>
          </section>
        </section>
      </div>
      <button
        type="button"
        className="dashboard-overlay"
        onClick={() => setIsMobileOpen(false)}
        aria-hidden={!isMobileOpen}
      />
    </main>
  )
}

export default AlertsPage
