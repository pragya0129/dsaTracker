import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OnboardingPage from './pages/OnboardingPage'
import DashboardPage from './pages/DashboardPage'
import PracticePage from './pages/PracticePage'
import ProfilePage from './pages/ProfilePage'
import ChallengePage from './pages/ChallengePage'
import ContestPage from './pages/ContestPage'
import CommunityPage from './pages/CommunityPage'

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                {/* /problems and /recommendations both point to the unified Practice page */}
                <Route path="/problems" element={<PracticePage />} />
                <Route path="/recommendations" element={<Navigate to="/problems" replace />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/challenges" element={<ChallengePage />} />
                <Route path="/contest/:id" element={<ContestPage />} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}
