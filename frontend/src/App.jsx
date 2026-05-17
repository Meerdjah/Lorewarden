import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ToastProvider } from './components/Toast'
import Dashboard from './pages/Dashboard'
import Karakter from './pages/Karakter'
import Session from './pages/Session'
import MusicPlayer from './pages/MusicPlayer'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="min-h-screen">
          <Navbar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/karakter" element={<Karakter />} />
            <Route path="/session" element={<Session />} />
            <Route path="/music" element={<MusicPlayer />} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}
