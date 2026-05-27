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
import Contact from './pages/Contact'
import { Toaster } from "react-hot-toast";

export default function App() {
    return (
        <BrowserRouter>

            <Toaster
                position="bottom-right"
                toastOptions={{
                    duration: 3000,
                    style: {
                        background: "#111827",
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "14px",
                        padding: "14px 18px",
                    },
                }}
            />
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
                <Route path="/contact" element={<Contact />} />
                <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
        </BrowserRouter>
    )
}
