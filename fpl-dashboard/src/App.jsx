import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Standings from './pages/Standings'
import RoundReview from './pages/RoundReview'
import TradeCenter from './pages/TradeCenter'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/"       element={<Standings />} />
          <Route path="/round"  element={<RoundReview />} />
          <Route path="/trades" element={<TradeCenter />} />
        </Routes>
      </main>
    </div>
  )
}
