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
  Switch,
  Tab,
  Tabs,
} from '@heroui/react'
import {
  ArrowLeftOnRectangleIcon,
  BellAlertIcon,
  ClockIcon,
  Cog6ToothIcon,
  DocumentChartBarIcon,
  KeyIcon,
  ServerStackIcon,
  SignalIcon,
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
import './Config.css'

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

const TARGET_TYPES = ['dns', 'web', 'router', 'olt', 'ont', 'host', 'other']
const TOKEN_SCOPES = ['read', 'write']

const formatDateTime = (value) => {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed)
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

function ConfigPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('settings')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [targets, setTargets] = useState([])
  const [isLoadingTargets, setIsLoadingTargets] = useState(false)
  const [isSavingTarget, setIsSavingTarget] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [activePingId, setActivePingId] = useState(null)
  const [lastCreatedId, setLastCreatedId] = useState(null)
  const [lastPingResult, setLastPingResult] = useState(null)
  const [targetError, setTargetError] = useState('')
  const [targetNotice, setTargetNotice] = useState('')
  const [editTarget, setEditTarget] = useState(null)
  const [editError, setEditError] = useState('')
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false)
  const [isDeletingTarget, setIsDeletingTarget] = useState(null)
  const [targetForm, setTargetForm] = useState({
    name: '',
    address: '',
    target_type: 'other',
    description: '',
    is_enabled: true,
    check_interval_seconds: '60',
    timeout_ms: '1000',
    expected_packets: '4',
  })
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    target_type: 'other',
    description: '',
    is_enabled: true,
    check_interval_seconds: '60',
    timeout_ms: '1000',
    expected_packets: '4',
  })

  const quickStats = useMemo(() => {
    const total = targets.length
    const active = targets.filter((target) => target.is_enabled).length
    const paused = total - active
    return [
      {
        label: 'Targets activos',
        value: String(active),
        note: `${paused} en pausa`,
      },
      { label: 'Tokens vigentes', value: '5', note: '2 lectura' },
      { label: 'Reglas activas', value: '8', note: '2 criticas' },
    ]
  }, [targets])

  const recentTargets = useMemo(() => {
    return [...targets].sort((a, b) => b.id - a.id).slice(0, 6)
  }, [targets])

  const tokenSamples = useMemo(
    () => [
      { name: 'UI Web', scope: 'read', last: 'Hace 5 min', enabled: true },
      { name: 'Worker Ping', scope: 'write', last: 'Hace 2 min', enabled: true },
      { name: 'Auditoria', scope: 'read', last: 'Hace 3 dias', enabled: false },
    ],
    [],
  )

  const statusRules = useMemo(
    () => [
      { label: 'Latencia maxima', value: '180 ms' },
      { label: 'Perdida permitida', value: '5%' },
      { label: 'Timeout por ping', value: '4 s' },
    ],
    [],
  )

  const updateTargetForm = (field, value) => {
    setTargetForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const updateEditForm = (field, value) => {
    setEditForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const toPositiveInt = (value, fallback) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed)
    }
    return fallback
  }

  const openEditTarget = (target) => {
    if (!target) return
    setEditError('')
    setEditTarget(target)
    setEditForm({
      name: target.name || '',
      address: target.address || '',
      target_type: target.target_type || 'other',
      description: target.description || '',
      is_enabled: Boolean(target.is_enabled),
      check_interval_seconds: String(target.check_interval_seconds ?? 60),
      timeout_ms: String(target.timeout_ms ?? 1000),
      expected_packets: String(target.expected_packets ?? 4),
    })
  }

  const closeEditTarget = () => {
    setEditTarget(null)
    setEditError('')
  }

  const fetchTargets = useCallback(async () => {
    setIsLoadingTargets(true)
    setTargetError('')
    setTargetNotice('')
    const token = getAuthToken()
    if (!token) {
      setTargetError('No hay sesion activa. Inicia sesion.')
      setTargets([])
      setIsLoadingTargets(false)
      return
    }
    try {
      const response = await apiFetch(`${API_BASE_URL}/targets/`)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setTargetError(
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
      setTargetError('No se pudo conectar con el servidor.')
      setTargets([])
    } finally {
      setIsLoadingTargets(false)
    }
  }, [])

  const handleCreateTarget = async () => {
    const name = targetForm.name.trim()
    const address = targetForm.address.trim()
    setTargetError('')
    setTargetNotice('')

    if (!name || !address) {
      setTargetError('Completa nombre y host/IP.')
      return
    }

    const token = getAuthToken()
    if (!token) {
      setTargetError('No hay sesion activa. Inicia sesion.')
      return
    }

    const payload = {
      name,
      address,
      target_type: targetForm.target_type,
      description: targetForm.description.trim(),
      is_enabled: targetForm.is_enabled,
      check_interval_seconds: toPositiveInt(targetForm.check_interval_seconds, 60),
      timeout_ms: toPositiveInt(targetForm.timeout_ms, 1000),
      expected_packets: toPositiveInt(targetForm.expected_packets, 4),
    }

    setIsSavingTarget(true)
    setTargetNotice('Enviando solicitud...')
    try {
      const response = await apiFetch(`${API_BASE_URL}/targets/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setTargetError(
          `HTTP ${response.status} - ${formatApiError(
            data,
            'No se pudo crear el target.',
          )}`,
        )
        setTargetNotice('')
        return
      }
      setTargets((prev) => [data, ...prev.filter((item) => item.id !== data.id)])
      setLastCreatedId(data.id)
      setTargetNotice('Target creado y guardado correctamente.')
      setTargetForm((prev) => ({
        ...prev,
        name: '',
        address: '',
        description: '',
      }))
    } catch (err) {
      setTargetError('No se pudo conectar con el servidor.')
      setTargetNotice('')
    } finally {
      setIsSavingTarget(false)
    }
  }

  const handlePingTarget = async (targetId) => {
    if (!targetId) {
      setTargetError('Selecciona un target para probar.')
      return
    }
    setTargetError('')
    setTargetNotice('')

    const token = getAuthToken()
    if (!token) {
      setTargetError('No hay sesion activa. Inicia sesion.')
      return
    }

    setIsPinging(true)
    setTargetNotice('Ejecutando ping...')
    setActivePingId(targetId)
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/targets/${targetId}/ping/`,
        {
          method: 'POST',
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setTargetError(
          `HTTP ${response.status} - ${formatApiError(
            payload,
            'No se pudo ejecutar el ping.',
          )}`,
        )
        setTargetNotice('')
        return
      }
      const targetInfo = targets.find((target) => target.id === targetId)
      setLastPingResult({
        ...payload,
        target: targetInfo,
      })
      setTargetNotice('Ping ejecutado y guardado en la base de datos.')
    } catch (err) {
      setTargetError('No se pudo conectar con el servidor.')
      setTargetNotice('')
    } finally {
      setIsPinging(false)
      setActivePingId(null)
    }
  }

  const handleUpdateTarget = async () => {
    if (!editTarget) return
    const name = editForm.name.trim()
    const address = editForm.address.trim()
    setEditError('')
    setTargetNotice('')

    if (!name || !address) {
      setEditError('Completa nombre y host/IP.')
      return
    }

    const token = getAuthToken()
    if (!token) {
      setEditError('No hay sesion activa. Inicia sesion.')
      return
    }

    const payload = {
      name,
      address,
      target_type: editForm.target_type,
      description: editForm.description.trim(),
      is_enabled: editForm.is_enabled,
      check_interval_seconds: toPositiveInt(editForm.check_interval_seconds, 60),
      timeout_ms: toPositiveInt(editForm.timeout_ms, 1000),
      expected_packets: toPositiveInt(editForm.expected_packets, 4),
    }

    setIsUpdatingTarget(true)
    try {
      const response = await apiFetch(
        `${API_BASE_URL}/targets/${editTarget.id}/`,
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
        setEditError(
          `HTTP ${response.status} - ${formatApiError(
            data,
            'No se pudo actualizar el target.',
          )}`,
        )
        return
      }
      setTargets((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)),
      )
      setTargetNotice('Target actualizado correctamente.')
      closeEditTarget()
    } catch (err) {
      setEditError('No se pudo conectar con el servidor.')
    } finally {
      setIsUpdatingTarget(false)
    }
  }

  const handleDeleteTarget = async (target) => {
    if (!target) return
    const confirmed = window.confirm(
      `Seguro que deseas eliminar el target "${target.name}"?`,
    )
    if (!confirmed) return

    setTargetError('')
    setTargetNotice('')
    setIsDeletingTarget(target.id)

    try {
      const response = await apiFetch(
        `${API_BASE_URL}/targets/${target.id}/`,
        {
          method: 'DELETE',
        },
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setTargetError(
          `HTTP ${response.status} - ${formatApiError(
            payload,
            'No se pudo eliminar el target.',
          )}`,
        )
        return
      }
      setTargets((prev) => prev.filter((item) => item.id !== target.id))
      if (lastCreatedId === target.id) {
        setLastCreatedId(null)
      }
      if (lastPingResult?.target?.id === target.id) {
        setLastPingResult(null)
      }
      setTargetNotice('Target eliminado correctamente.')
    } catch (err) {
      setTargetError('No se pudo conectar con el servidor.')
    } finally {
      setIsDeletingTarget(null)
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

  const handleLogout = () => {
    clearAuthTokens()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    fetchTargets()
  }, [fetchTargets])

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
                <h1 className="dashboard-title">Configuracion</h1>
                <p className="dashboard-subtitle">
                  Administra targets, tokens y estado desde un solo lugar.
                </p>
              </div>
            </div>
            <div className="top-actions">
              <Button variant="bordered" onPress={fetchTargets}>
                Actualizar
              </Button>
              <Button color="primary" variant="shadow">
                Guardar cambios
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>

          <section className="config-overview">
            {quickStats.map((stat) => (
              <Card key={stat.label} className="config-card">
                <CardHeader className="config-stat-header">
                  <span>{stat.label}</span>
                  <Chip size="sm" variant="flat">
                    {stat.note}
                  </Chip>
                </CardHeader>
                <CardBody className="config-stat-body">
                  <p>{stat.value}</p>
                </CardBody>
              </Card>
            ))}
          </section>

          <section className="config-tabs">
            <Tabs aria-label="Configuracion" variant="underlined" color="primary">
              <Tab
                key="targets"
                title={
                  <div className="config-tab-title">
                    <ServerStackIcon className="config-tab-icon" />
                    <span>Targets</span>
                  </div>
                }
              >
                <div className="config-tab-panel">
                  <div className="config-panel-grid">
                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Nuevo target</p>
                          <p className="config-panel-subtitle">
                            Define el destino que sera monitoreado.
                          </p>
                        </div>
                        <Chip size="sm" variant="flat" color="primary">
                          Activo
                        </Chip>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-form">
                          <div className="config-form-row">
                            <Input
                              label="Nombre"
                              placeholder="OLT Plaza"
                              value={targetForm.name}
                              onValueChange={(value) =>
                                updateTargetForm('name', value)
                              }
                            />
                            <Input
                              label="Host / IP"
                              placeholder="10.10.2.4"
                              value={targetForm.address}
                              onValueChange={(value) =>
                                updateTargetForm('address', value)
                              }
                            />
                          </div>
                          <Select
                            label="Tipo de target"
                            placeholder="Selecciona un tipo"
                            selectedKeys={[targetForm.target_type]}
                            onSelectionChange={(keys) =>
                              updateTargetForm(
                                'target_type',
                                Array.from(keys)[0] || 'other',
                              )
                            }
                          >
                            {TARGET_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </Select>
                          <div className="config-form-row">
                            <Switch
                              color="primary"
                              isSelected={targetForm.is_enabled}
                              onValueChange={(value) =>
                                updateTargetForm('is_enabled', value)
                              }
                            >
                              Activo
                            </Switch>
                            <Input
                              label="Notas"
                              placeholder="Segmento norte"
                              value={targetForm.description}
                              onValueChange={(value) =>
                                updateTargetForm('description', value)
                              }
                            />
                          </div>
                          <div className="config-form-row">
                            <Input
                              label="Intervalo (s)"
                              type="number"
                              min="5"
                              value={targetForm.check_interval_seconds}
                              onValueChange={(value) =>
                                updateTargetForm('check_interval_seconds', value)
                              }
                            />
                            <Input
                              label="Timeout (ms)"
                              type="number"
                              min="100"
                              value={targetForm.timeout_ms}
                              onValueChange={(value) =>
                                updateTargetForm('timeout_ms', value)
                              }
                            />
                            <Input
                              label="Paquetes"
                              type="number"
                              min="1"
                              value={targetForm.expected_packets}
                              onValueChange={(value) =>
                                updateTargetForm('expected_packets', value)
                              }
                            />
                          </div>
                          <div className="config-actions">
                            <Button
                              color="primary"
                              onPress={handleCreateTarget}
                              isLoading={isSavingTarget}
                            >
                              Guardar target
                            </Button>
                            <Button
                              variant="bordered"
                              isDisabled={!lastCreatedId}
                              isLoading={
                                isPinging && activePingId === lastCreatedId
                              }
                              onPress={() => handlePingTarget(lastCreatedId)}
                            >
                              Probar ping
                            </Button>
                          </div>
                          {targetError ? (
                            <p className="config-error">{targetError}</p>
                          ) : null}
                          {targetNotice ? (
                            <p className="config-success">{targetNotice}</p>
                          ) : null}
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Targets recientes</p>
                          <p className="config-panel-subtitle">
                            Ordenados por ultima edicion.
                          </p>
                        </div>
                        <Chip size="sm" variant="flat">
                          {isLoadingTargets
                            ? 'Cargando'
                            : `${targets.length} targets`}
                        </Chip>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-list">
                          {recentTargets.length === 0 && !isLoadingTargets ? (
                            <p className="config-empty">
                              Aun no hay targets registrados.
                            </p>
                          ) : null}
                          {recentTargets.map((target) => (
                            <div key={target.id} className="config-list-row">
                              <div>
                                <p className="config-list-title">
                                  {target.name}
                                </p>
                                <p className="config-list-subtitle">
                                  {target.address} · {target.target_type}
                                </p>
                              </div>
                              <div className="config-target-actions">
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={
                                    target.is_enabled ? 'success' : 'default'
                                  }
                                >
                                  {target.is_enabled ? 'Activo' : 'Pausado'}
                                </Chip>
                                <Button
                                  size="sm"
                                  variant="bordered"
                                  isLoading={
                                    isPinging && activePingId === target.id
                                  }
                                  onPress={() => handlePingTarget(target.id)}
                                >
                                  Ping
                                </Button>
                                <Button
                                  size="sm"
                                  variant="bordered"
                                  onPress={() => openEditTarget(target)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  isLoading={isDeletingTarget === target.id}
                                  onPress={() => handleDeleteTarget(target)}
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                          ))}
                          <Divider />
                          {lastPingResult ? (
                            <div className="config-ping-result">
                              <div className="config-ping-header">
                                <p className="config-list-title">Ultimo ping</p>
                                <Chip
                                  size="sm"
                                  variant="flat"
                                  color={
                                    lastPingResult.current_status?.status ===
                                    'UP'
                                      ? 'success'
                                      : lastPingResult.current_status?.status ===
                                        'DOWN'
                                      ? 'danger'
                                      : 'default'
                                  }
                                >
                                  {lastPingResult.current_status?.status || 'N/A'}
                                </Chip>
                              </div>
                              <p className="config-list-subtitle">
                                {lastPingResult.target
                                  ? `${lastPingResult.target.name} · ${lastPingResult.target.address}`
                                  : `Target #${lastPingResult.current_status?.target_id || '-'}`}
                              </p>
                              <div className="config-ping-chips">
                                <Chip size="sm" variant="flat">
                                  Latencia{' '}
                                  {lastPingResult.current_status
                                    ?.last_latency_ms ?? '-'}{' '}
                                  ms
                                </Chip>
                                <Chip size="sm" variant="flat">
                                  Perdida{' '}
                                  {lastPingResult.current_status
                                    ?.last_packet_loss_percent ?? '-'}
                                  %
                                </Chip>
                                <Chip size="sm" variant="flat">
                                  TTL{' '}
                                  {lastPingResult.current_status?.last_ttl ?? '-'}
                                </Chip>
                              </div>
                              {lastPingResult.entry?.e ? (
                                <p className="config-ping-error">
                                  {lastPingResult.entry.e}
                                </p>
                              ) : null}
                              <p className="config-list-subtitle">
                                Verificado:{' '}
                                {formatDateTime(
                                  lastPingResult.current_status
                                    ?.last_checked_at ||
                                    lastPingResult.entry?.t,
                                )}
                              </p>
                            </div>
                          ) : (
                            <p className="config-empty">
                              Ejecuta un ping para validar conectividad.
                            </p>
                          )}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>

              <Tab
                key="tokens"
                title={
                  <div className="config-tab-title">
                    <KeyIcon className="config-tab-icon" />
                    <span>Tokens</span>
                  </div>
                }
              >
                <div className="config-tab-panel">
                  <div className="config-panel-grid">
                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Emitir token</p>
                          <p className="config-panel-subtitle">
                            Controla lectura y escritura de la API.
                          </p>
                        </div>
                        <Chip size="sm" variant="flat" color="warning">
                          Seguro
                        </Chip>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-form">
                          <Input label="Descripcion" placeholder="UI Web" />
                          <div className="config-form-row">
                            <Select label="Scope" placeholder="read / write">
                              {TOKEN_SCOPES.map((scope) => (
                                <SelectItem key={scope} value={scope}>
                                  {scope}
                                </SelectItem>
                              ))}
                            </Select>
                            <Input label="Expira en dias" placeholder="30" />
                          </div>
                          <Switch defaultSelected color="primary">
                            Habilitado
                          </Switch>
                          <div className="config-actions">
                            <Button color="primary">Generar token</Button>
                            <Button variant="bordered">Copiar ultimo</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Tokens activos</p>
                          <p className="config-panel-subtitle">
                            Ultimo uso reportado por la API.
                          </p>
                        </div>
                        <Button size="sm" variant="light">
                          Gestionar
                        </Button>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-list">
                          {tokenSamples.map((token) => (
                            <div key={token.name} className="config-list-row">
                              <div>
                                <p className="config-list-title">
                                  {token.name}
                                </p>
                                <p className="config-list-subtitle">
                                  {token.scope} · {token.last}
                                </p>
                              </div>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={token.enabled ? 'success' : 'default'}
                              >
                                {token.enabled ? 'Activo' : 'Pausado'}
                              </Chip>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>

              <Tab
                key="estado"
                title={
                  <div className="config-tab-title">
                    <SignalIcon className="config-tab-icon" />
                    <span>Estado</span>
                  </div>
                }
              >
                <div className="config-tab-panel">
                  <div className="config-panel-grid">
                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Reglas de estado</p>
                          <p className="config-panel-subtitle">
                            Umbrales para UP / DOWN y alertas.
                          </p>
                        </div>
                        <Chip size="sm" variant="flat">
                          NOC
                        </Chip>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-form">
                          <div className="config-form-row">
                            <Input label="Latencia max (ms)" placeholder="180" />
                            <Input label="Perdida (%)" placeholder="5" />
                          </div>
                          <div className="config-form-row">
                            <Input label="Timeout (s)" placeholder="4" />
                            <Input label="Reintentos" placeholder="3" />
                          </div>
                          <Switch defaultSelected color="primary">
                            Alertas automaticas
                          </Switch>
                          <div className="config-actions">
                            <Button color="primary">Guardar reglas</Button>
                            <Button variant="bordered">Restaurar</Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>

                    <Card className="config-card">
                      <CardHeader className="config-panel-header">
                        <div>
                          <p className="config-panel-title">Estado actual</p>
                          <p className="config-panel-subtitle">
                            Resumen en tiempo real.
                          </p>
                        </div>
                        <Button size="sm" variant="light">
                          Actualizar
                        </Button>
                      </CardHeader>
                      <CardBody className="config-panel-body">
                        <div className="config-list">
                          {statusRules.map((rule) => (
                            <div key={rule.label} className="config-list-row">
                              <span className="config-list-title">
                                {rule.label}
                              </span>
                              <Chip size="sm" variant="flat" color="primary">
                                {rule.value}
                              </Chip>
                            </div>
                          ))}
                          <div className="config-status-inline">
                            <Chip color="success" variant="flat">
                              18 UP
                            </Chip>
                            <Chip color="danger" variant="flat">
                              2 DOWN
                            </Chip>
                            <Chip color="warning" variant="flat">
                              4 en pausa
                            </Chip>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  </div>
                </div>
              </Tab>
            </Tabs>
          </section>
        </section>
      </div>
      <button
        type="button"
        className="dashboard-overlay"
        onClick={() => setIsMobileOpen(false)}
        aria-hidden={!isMobileOpen}
      />
      {editTarget ? (
        <div className="config-modal-backdrop" onClick={closeEditTarget}>
          <div
            className="config-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="config-modal-header">
              <div>
                <p className="config-modal-title">Editar target</p>
                <p className="config-modal-subtitle">
                  Actualiza parametros y guarda los cambios.
                </p>
              </div>
              <Button
                isIconOnly
                variant="light"
                onPress={closeEditTarget}
                aria-label="Cerrar"
              >
                X
              </Button>
            </div>
            <Divider />
            <div className="config-modal-body">
              <div className="config-form">
                <div className="config-form-row">
                  <Input
                    label="Nombre"
                    placeholder="OLT Plaza"
                    value={editForm.name}
                    onValueChange={(value) => updateEditForm('name', value)}
                  />
                  <Input
                    label="Host / IP"
                    placeholder="10.10.2.4"
                    value={editForm.address}
                    onValueChange={(value) => updateEditForm('address', value)}
                  />
                </div>
                <Select
                  label="Tipo de target"
                  placeholder="Selecciona un tipo"
                  selectedKeys={[editForm.target_type]}
                  onSelectionChange={(keys) =>
                    updateEditForm(
                      'target_type',
                      Array.from(keys)[0] || 'other',
                    )
                  }
                >
                  {TARGET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </Select>
                <div className="config-form-row">
                  <Switch
                    color="primary"
                    isSelected={editForm.is_enabled}
                    onValueChange={(value) =>
                      updateEditForm('is_enabled', value)
                    }
                  >
                    Activo
                  </Switch>
                  <Input
                    label="Notas"
                    placeholder="Segmento norte"
                    value={editForm.description}
                    onValueChange={(value) =>
                      updateEditForm('description', value)
                    }
                  />
                </div>
                <div className="config-form-row">
                  <Input
                    label="Intervalo (s)"
                    type="number"
                    min="5"
                    value={editForm.check_interval_seconds}
                    onValueChange={(value) =>
                      updateEditForm('check_interval_seconds', value)
                    }
                  />
                  <Input
                    label="Timeout (ms)"
                    type="number"
                    min="100"
                    value={editForm.timeout_ms}
                    onValueChange={(value) =>
                      updateEditForm('timeout_ms', value)
                    }
                  />
                  <Input
                    label="Paquetes"
                    type="number"
                    min="1"
                    value={editForm.expected_packets}
                    onValueChange={(value) =>
                      updateEditForm('expected_packets', value)
                    }
                  />
                </div>
                {editError ? <p className="config-error">{editError}</p> : null}
              </div>
            </div>
            <Divider />
            <div className="config-modal-footer">
              <Button variant="bordered" onPress={closeEditTarget}>
                Cancelar
              </Button>
              <Button
                color="primary"
                onPress={handleUpdateTarget}
                isLoading={isUpdatingTarget}
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

export default ConfigPage
