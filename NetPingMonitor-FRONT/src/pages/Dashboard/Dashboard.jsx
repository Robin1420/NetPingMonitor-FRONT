import { useMemo, useState } from 'react'
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
  Progress,
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

function DashboardPage() {
  const navigate = useNavigate()
  const [activeId, setActiveId] = useState('overview')
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const quickStats = useMemo(
    () => [
      { label: 'Targets activos', value: '24', delta: '+2 hoy' },
      { label: 'Alertas abiertas', value: '3', delta: '1 critica' },
      { label: 'Latencia media', value: '32 ms', delta: 'Ultima hora' },
      { label: 'Perdida media', value: '0.4%', delta: 'Ultima hora' },
    ],
    [],
  )

  const recentAlerts = useMemo(
    () => [
      { title: 'OLT-03 sin respuesta', time: 'Hace 2 min', level: 'critica' },
      { title: 'Router Core jitter alto', time: 'Hace 7 min', level: 'media' },
      { title: 'ONT-221 recuperado', time: 'Hace 18 min', level: 'ok' },
    ],
    [],
  )

  const recentTargets = useMemo(
    () => [
      { name: 'Core DNS 1', status: 'UP', latency: '18 ms' },
      { name: 'OLT Plaza', status: 'DOWN', latency: 'timeout' },
      { name: 'Router BGP', status: 'UP', latency: '24 ms' },
      { name: 'POP Norte', status: 'UP', latency: '31 ms' },
    ],
    [],
  )

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
              />
              <Button color="primary" variant="shadow">
                Actualizar
              </Button>
              <Avatar name="NOC" size="sm" />
            </div>
          </header>

          <section className="dashboard-grid">
            {quickStats.map((stat) => (
              <Card key={stat.label} className="stat-card">
                <CardHeader className="stat-header">
                  <span>{stat.label}</span>
                  <Chip size="sm" variant="flat">
                    {stat.delta}
                  </Chip>
                </CardHeader>
                <CardBody className="stat-body">
                  <p>{stat.value}</p>
                </CardBody>
              </Card>
            ))}
          </section>

          <section className="dashboard-panels">
            <Card className="panel-card">
              <CardHeader className="panel-header">
                <div>
                  <p className="panel-title">Alertas recientes</p>
                  <p className="panel-subtitle">
                    Cambios de estado en tiempo real.
                  </p>
                </div>
                <Button variant="light" size="sm">
                  Ver todas
                </Button>
              </CardHeader>
              <CardBody className="panel-body">
                {recentAlerts.map((alert) => (
                  <div key={alert.title} className="panel-row">
                    <div>
                      <p className="panel-row-title">{alert.title}</p>
                      <p className="panel-row-subtitle">{alert.time}</p>
                    </div>
                    <Chip
                      size="sm"
                      color={
                        alert.level === 'critica'
                          ? 'danger'
                          : alert.level === 'media'
                          ? 'warning'
                          : 'success'
                      }
                      variant="flat"
                    >
                      {alert.level}
                    </Chip>
                  </div>
                ))}
              </CardBody>
            </Card>

            <Card className="panel-card">
              <CardHeader className="panel-header">
                <div>
                  <p className="panel-title">Targets clave</p>
                  <p className="panel-subtitle">
                    Estado y latencia por segmento.
                  </p>
                </div>
                <Button variant="light" size="sm">
                  Administrar
                </Button>
              </CardHeader>
              <CardBody className="panel-body">
                {recentTargets.map((target) => (
                  <div key={target.name} className="panel-row">
                    <div>
                      <p className="panel-row-title">{target.name}</p>
                      <p className="panel-row-subtitle">{target.latency}</p>
                    </div>
                    <Chip
                      size="sm"
                      color={target.status === 'UP' ? 'success' : 'danger'}
                      variant="flat"
                    >
                      {target.status}
                    </Chip>
                  </div>
                ))}
                <div className="panel-progress">
                  <Progress
                    label="Disponibilidad global"
                    value={92}
                    color="primary"
                    showValueLabel
                  />
                </div>
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

export default DashboardPage
