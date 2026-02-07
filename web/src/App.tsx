import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Enter from './pages/Enter'
import Leaderboard from './pages/Leaderboard'
import Match from './pages/Match'
import HowToPlay from './pages/HowToPlay'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/enter" element={<Enter />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/match/:tournamentId/:matchIndex" element={<Match />} />
        <Route path="/how-to-play" element={<HowToPlay />} />
      </Routes>
    </Layout>
  )
}
