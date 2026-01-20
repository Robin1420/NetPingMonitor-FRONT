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
  Select,
  SelectItem,
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
import './History.css'

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


const formatDateTime = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
}

function HistoryPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('history')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [targets, setTargets] = useState([])
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [limit, setLimit] = useState('24')
  const [logs, setLogs] = useState([])
  const [isLoadingTargets, setIsLoadingTargets] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [error, setError] = useState('')

  const summary = useMemo(() => {
    return logs.reduce(
      (acc, log) => {
        const total = Number(log.total_count || 0)
        const up = Number(log.up_count || 0)
        const down = Number(log.down_count || 0)
        const latencyCount = Number(log.latency_count || 0)
        const avgLatency = Number(log.avg_latency_ms || 0)
        acc.total += total
        acc.up += up
        acc.down += down
        acc.latencySum += avgLatency * latencyCount
        acc.latencyCount += latencyCount
        return acc
      },
      { total: 0, up: 0, down: 0, latencySum: 0, latencyCount: 0 },
    )
  }, [logs])

  const avgLatency = summary.latencyCount
    ? Math.round(summary.latencySum / summary.latencyCount)
    : null

  const fetchTargets = useCallback(async () => {
    setIsLoadingTargets(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      setError('No hay sesion activa. Inicia sesion.')
      setTargets([])
      setIsLoadingTargets(false)
      return
    }
    try {
      const response = await apiFetch(`${API_BASE_URL}/targets/`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.detail || 'No se pudo cargar targets.')
        setTargets([])
        return
      }
      const list = Array.isArray(payload) ? payload : []
      setTargets(list)
      if (!selectedTargetId && list.length > 0) {
        setSelectedTargetId(String(list[0].id))
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
      setTargets([])
    } finally {
      setIsLoadingTargets(false)
    }
  }, [selectedTargetId])

  const fetchHistory = useCallback(async () => {
    if (!selectedTargetId) {
      setLogs([])
      return
    }
    setIsLoadingLogs(true)
    setError('')
    const token = getAuthToken()
    if (!token) {
      setError('No hay sesion activa. Inicia sesion.')
      setLogs([])
      setIsLoadingLogs(false)
      return
    }
    const params = new URLSearchParams()
    if (fromDate) {
      params.append('from', fromDate)
    }
    if (toDate) {
      params.append('to', toDate)
    }
    const limitValue = Number(limit)
    if (limit && Number.isFinite(limitValue) && limitValue > 0) {
      params.append('limit', String(limitValue))
    }
    const query = params.toString()

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/targets/${selectedTargetId}/history/${query ? `?${query}` : ''}`,
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(payload.detail || 'No se pudo cargar el historial.')
        setLogs([])
        return
      }
      setLogs(Array.isArray(payload) ? payload : [])
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
      setLogs([])
    } finally {
      setIsLoadingLogs(false)
    }
  }, [fromDate, limit, selectedTargetId, toDate])

  const handleApply = () => {
    fetchHistory()
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
    fetchTargets()
  }, [fetchTargets])

  useEffect(() => {
    if (selectedTargetId) {
      fetchHistory()
    }
  }, [selectedTargetId, fetchHistory])

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
                <h1 className="dashboard-title">Historial por hora</h1>
                <p className="dashboard-subtitle">
                  Analiza el log horario de cada target.
                </p>
              </div>
            </div>
            <div className="top-actions">
              <Button variant="bordered" onPress={handleApply}>
                Actualizar
              </Button>
              <Button color="primary" variant="shadow">
                Exportar
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>
          <section className="history-filters">
            <Card className="history-filter-card">
              <CardHeader className="history-filter-header">
                <div>
                  <p className="history-filter-title">Filtros</p>
                  <p className="history-filter-subtitle">
                    Selecciona target y rango de fechas.
                  </p>
                </div>
                <Chip size="sm" variant="flat">
                  {isLoadingTargets ? 'Cargando' : `${targets.length} targets`}
                </Chip>
              </CardHeader>
              <CardBody className="history-filter-body">
                <div className="history-filter-grid">
                  <Select
                    label="Target"
                    placeholder="Selecciona un target"
                    selectedKeys={selectedTargetId ? [selectedTargetId] : []}
                    onSelectionChange={(keys) =>
                      setSelectedTargetId(String(Array.from(keys)[0] || ''))
                    }
                    isDisabled={isLoadingTargets}
                  >
                    {targets.map((target) => (
                      <SelectItem key={String(target.id)} value={String(target.id)}>
                        {target.name} · {target.address}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    label="Desde"
                    type="date"
                    value={fromDate}
                    onValueChange={setFromDate}
                  />
                  <Input
                    label="Hasta"
                    type="date"
                    value={toDate}
                    onValueChange={setToDate}
                  />
                  <Input
                    label="Limite (horas)"
                    type="number"
                    min="1"
                    value={limit}
                    onValueChange={setLimit}
                  />
                </div>
                <div className="history-filter-actions">
                  <Button color="primary" onPress={handleApply}>
                    Buscar
                  </Button>
                  <Button
                    variant="bordered"
                    onPress={() => {
                      setFromDate('')
                      setToDate('')
                      setLimit('24')
                    }}
                  >
                    Limpiar
                  </Button>
                </div>
              </CardBody>
            </Card>
          </section>
          <section className="history-summary">
            <Card className="history-summary-card">
              <CardHeader className="history-summary-header">
                <span>Total registros</span>
                <Chip size="sm" variant="flat">
                  Horas
                </Chip>
              </CardHeader>
              <CardBody className="history-summary-body">
                <p>{logs.length}</p>
              </CardBody>
            </Card>
            <Card className="history-summary-card">
              <CardHeader className="history-summary-header">
                <span>Eventos UP / DOWN</span>
                <Chip size="sm" variant="flat" color="primary">
                  Conteo
                </Chip>
              </CardHeader>
              <CardBody className="history-summary-body">
                <p>
                  {summary.up} / {summary.down}
                </p>
              </CardBody>
            </Card>
            <Card className="history-summary-card">
              <CardHeader className="history-summary-header">
                <span>Latencia promedio</span>
                <Chip size="sm" variant="flat" color="warning">
                  ms
                </Chip>
              </CardHeader>
              <CardBody className="history-summary-body">
                <p>{avgLatency ?? '-'}</p>
              </CardBody>
            </Card>
          </section>



          <section className="history-list">
            <Card className="history-card">
              <CardHeader className="history-card-header">
                <div>
                  <p className="history-card-title">Log horario</p>
                  <p className="history-card-subtitle">
                    Entradas agregadas por hora.
                  </p>
                </div>
                {isLoadingLogs ? (
                  <Chip size="sm" variant="flat">
                    Cargando
                  </Chip>
                ) : (
                  <Chip size="sm" variant="flat" color="primary">
                    {logs.length} bloques
                  </Chip>
                )}
              </CardHeader>
              <CardBody className="history-card-body">
                {error ? <p className="history-error">{error}</p> : null}
                {!isLoadingLogs && !error && logs.length === 0 ? (
                  <p className="history-empty">
                    No hay historial para el target seleccionado.
                  </p>
                ) : null}
                {logs.map((log) => (
                  <div key={log.id} className="history-row">
                    <div className="history-row-main">
                      <div>
                        <p className="history-row-title">
                          {formatDateTime(log.bucket_start)}
                        </p>
                        <p className="history-row-subtitle">
                          Entradas: {log.total_count} · Latencia media:{' '}
                          {log.avg_latency_ms ?? '-'} ms
                        </p>
                      </div>
                      <div className="history-row-chips">
                        <Chip size="sm" variant="flat" color="success">
                          UP {log.up_count}
                        </Chip>
                        <Chip size="sm" variant="flat" color="danger">
                          DOWN {log.down_count}
                        </Chip>
                        <Chip size="sm" variant="flat">
                          Max {log.max_latency_ms ?? '-'} ms
                        </Chip>
                        <Chip size="sm" variant="flat">
                          Min {log.min_latency_ms ?? '-'} ms
                        </Chip>
                      </div>
                    </div>
                    <details className="history-row-details">
                      <summary>Ver JSON ({log.entries?.length || 0})</summary>
                      <pre>
                        {JSON.stringify(log.entries || [], null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
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

export default HistoryPage
