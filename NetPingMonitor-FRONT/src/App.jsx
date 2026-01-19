import { Navigate, Route, Routes } from 'react-router-dom'
import AlertsPage from './pages/Alerts/Alerts.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import ConfigPage from './pages/Config/Config.jsx'
import DashboardPage from './pages/Dashboard/Dashboard.jsx'
import HistoryPage from './pages/History/History.jsx'
import LoginPage from './pages/Login/Login.jsx'
import NotFoundPage from './pages/NotFound/NotFound.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/config" element={<ConfigPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
