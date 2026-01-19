import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  Divider,
  Input,
  Link,
} from '@heroui/react'
import gponLogo from '../../assets/img/Gponlogo.jpg'
import { API_BASE_URL, clearAuthTokens } from '../../utils/apiClient'
import './Login.css'

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setError('Completa usuario y clave.')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
        }),
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(payload.detail || 'Credenciales invalidas.')
        return
      }

      clearAuthTokens()
      const storage = remember ? localStorage : sessionStorage
      if (payload.access) {
        storage.setItem('access_token', payload.access)
      }
      if (payload.refresh) {
        storage.setItem('refresh_token', payload.refresh)
      }
      navigate('/dashboard')
    } catch (err) {
      setError('No se pudo conectar con el servidor.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="login">
      <section className="login-shell">
        <div className="login-aside">
          <div className="login-brand">
            <img src={gponLogo} alt="Gpon logo" className="login-logo" />
            <div>
              <p className="login-brand-title">NetPingMonitor</p>
              <p className="login-brand-subtitle">Panel NOC de disponibilidad</p>
            </div>
          </div>
          <h1 className="login-headline">
            Monitoreo ICMP continuo para operaciones 24/7.
          </h1>
          <p className="login-copy">
            Consolida latencia, perdida y alertas en un tablero operativo claro
            para GPON.
          </p>
          <div className="login-stats">
            <div className="login-stat">
              <span className="login-stat-value">Alertas activas</span>
              <span className="login-stat-label">Deteccion de caidas y subida</span>
            </div>
            <div className="login-stat">
              <span className="login-stat-value">Historial por hora</span>
              <span className="login-stat-label">JSON por hora y trazabilidad</span>
            </div>
          </div>
          <div className="login-pulse">
            <span className="login-pulse-dot" />
            <span>Canal ICMP activo</span>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <Card className="login-card" shadow="lg">
            <CardHeader className="login-card-header">
              <div>
                <p className="login-card-title">Iniciar sesion</p>
                <p className="login-card-subtitle">
                  Ingresa con tu cuenta NOC
                </p>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="login-card-body">
              <Input
                label="Usuario o correo"
                placeholder="noc@empresa.com"
                variant="bordered"
                autoComplete="username"
                value={username}
                onValueChange={setUsername}
              />
              <Input
                label="Contrasena"
                placeholder="********"
                type="password"
                variant="bordered"
                autoComplete="current-password"
                value={password}
                onValueChange={setPassword}
              />
              <div className="login-row">
                <Checkbox
                  color="primary"
                  isSelected={remember}
                  onValueChange={setRemember}
                >
                  Recordarme
                </Checkbox>
                <Link href="#" underline="hover" className="login-link">
                  Olvide mi clave
                </Link>
              </div>
              {error ? <p className="login-error">{error}</p> : null}
            </CardBody>
            <Divider />
            <CardFooter className="login-card-footer">
              <Button
                color="primary"
                variant="shadow"
                fullWidth
                type="submit"
                isLoading={isLoading}
              >
                Entrar
              </Button>
              <Button variant="bordered" fullWidth type="button">
                Solicitar acceso
              </Button>
            </CardFooter>
          </Card>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
