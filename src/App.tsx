import React, { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "./context/LanguageContext";
import { ThemeProvider } from "./context/ThemeContext";
import { Layout } from "./components/layout/Layout";
import { ScrollToTop } from "./components/layout/ScrollToTop";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { NotFound } from "./pages/NotFound/NotFound";
import { RouteLoader } from "./components/common/RouteLoader";
import { useAuthStore } from "./store/useAuthStore";

// Lazy loading website components for better performance
const Home = lazy(() => import("./pages/Home/Home").then(m => ({ default: m.Home })));
const About = lazy(() => import("./pages/About/About").then(m => ({ default: m.About })));
const Programs = lazy(() => import("./pages/Programs/Programs").then(m => ({ default: m.Programs })));
const Events = lazy(() => import("./pages/Events/Events").then(m => ({ default: m.Events })));
const Media = lazy(() => import("./pages/Media/Media").then(m => ({ default: m.Media })));
const PostDetail = lazy(() => import("./pages/Media/PostDetail").then(m => ({ default: m.PostDetail })));
const Contact = lazy(() => import("./pages/Contact/Contact").then(m => ({ default: m.Contact })));
const Dashboard = lazy(() => import("./pages/Dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const GamesHub = lazy(() => import("./pages/GamesHub/GamesHub").then(m => ({ default: m.GamesHub })));
const LearningHub = lazy(() => import("./pages/LearningHub/LearningHub").then(m => ({ default: m.LearningHub })));
const Opportunities = lazy(() => import("./pages/Opportunities/Opportunities").then(m => ({ default: m.Opportunities })));
const Portals = lazy(() => import("./pages/Portals/Portals").then(m => ({ default: m.Portals })));
const MemberLogin = lazy(() => import("./pages/Auth/MemberLogin").then(m => ({ default: m.MemberLogin })));
const MemberRegister = lazy(() => import("./pages/Auth/MemberRegister").then(m => ({ default: m.MemberRegister })));

// Lazy loading admin panel (completely separate bundle and layout)
const AdminLayout = lazy(() => import("./pages/Admin/AdminLayout").then(m => ({ default: m.AdminLayout })));

const App: React.FC = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  useEffect(() => {
    const unsubscribe = initializeAuth();
    return unsubscribe;
  }, [initializeAuth]);

  return (
    <ThemeProvider>
      <LanguageProvider>
        <BrowserRouter>
          <ScrollToTop />
          <ErrorBoundary>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                {/* Main Website Layout */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="programs" element={<Programs />} />
                  <Route path="events" element={<Events />} />
                  <Route path="learning-hub" element={<LearningHub />} />
                  <Route path="media" element={<Media />} />
                  <Route path="blog/:id" element={<PostDetail />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="games" element={<GamesHub />} />
                  <Route path="opportunities" element={<Opportunities />} />
                  <Route path="partners" element={<Portals />} />
                  {/* الرابط القديم — الصفحة اتغيرت من البوابات للشركاء */}
                  <Route path="portals" element={<Navigate to="/partners" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="login" element={<MemberLogin />} />
                  <Route path="register" element={<MemberRegister />} />
                  {/* Real 404 — previously this rendered <Home/>, so every bad URL answered 200 */}
                  <Route path="*" element={<NotFound />} />
                </Route>

                {/* Completely separate Admin CMS — No website Header/Footer */}
                <Route path="/admin/*" element={<AdminLayout />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;
