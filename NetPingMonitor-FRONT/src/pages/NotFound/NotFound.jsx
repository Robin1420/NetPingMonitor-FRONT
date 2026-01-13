import { Button, Card, CardBody } from '@heroui/react'
import { useNavigate } from 'react-router-dom'
import './NotFound.css'

function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <main className="notfound">
      <Card className="notfound-card">
        <CardBody className="notfound-body">
          <p className="notfound-code">404</p>
          <h1 className="notfound-title">Pagina no encontrada</h1>
          <p className="notfound-copy">
            Esta ruta no existe o fue movida.
          </p>
          <Button color="primary" variant="shadow" onPress={() => navigate('/login')}>
            Volver al login
          </Button>
        </CardBody>
      </Card>
    </main>
  )
}

export default NotFoundPage
