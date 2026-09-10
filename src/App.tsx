import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SessionProvider } from './context/SessionContext'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/HomePage'
import { AudioAnalysisPage } from './pages/AudioAnalysisPage'
import { EnrollPage } from './pages/EnrollPage'
import { CallPage } from './pages/CallPage'
import { BankingPage } from './pages/BankingPage'
import { IncidentsPage } from './pages/IncidentsPage'
import { PolicyPage } from './pages/PolicyPage'
import { SourcesPage } from './pages/SourcesPage'
import { ArchitecturePage } from './pages/ArchitecturePage'

export default function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/analyze" element={<AudioAnalysisPage />} />
            <Route path="/demo" element={<Navigate to="/" replace />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/enroll" element={<EnrollPage />} />
            <Route path="/call" element={<CallPage />} />
            <Route path="/banking" element={<BankingPage />} />
            <Route path="/incidents" element={<IncidentsPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/policy" element={<PolicyPage />} />
            <Route path="/architecture" element={<ArchitecturePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}
