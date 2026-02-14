import React from 'react';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import HeroSection from '../components/heroSection';
import LegalBentoGrid from '../components/LegalBentoGrid'; // Import the new grid
import Footer from '../components/Footer';
import { useTheme } from '../context/themeContext';
import { useAuth } from '../context/Authcontext';
import { useNavigate } from "react-router-dom";


const scalesBgUrl = "/scale.png";

const LandingPage = () => {
  const { isDark } = useTheme();
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect logged-in users to their dashboard (only from landing page)
  useEffect(() => {
    if (!loading && user && location.pathname === '/') {
      const role = userRole || 'citizen';
      if (role === 'police') {
        navigate('/police-dashboard', { replace: true });
      } else if (role === 'lawyer') {
        navigate('/lawyer/legal-dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, userRole, loading, navigate, location.pathname]);

  // Show loading screen while checking auth and redirecting
  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0B1120]' : 'bg-[#FFFAF0]'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 font-sans overflow-hidden relative ${isDark ? 'bg-[#0B1120] text-slate-100' : 'bg-[#FFFAF0] text-slate-900'}`}>
      
      {/* Background Gradients */}
      <div className="fixed inset-0 pointer-events-none transition-opacity duration-700">
        <div className={`absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full blur-[150px] mix-blend-multiply transition-colors duration-700 ${isDark ? 'bg-indigo-900/20' : 'bg-amber-200/30'}`}></div>
        <div className={`absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[150px] mix-blend-multiply transition-colors duration-700 ${isDark ? 'bg-blue-900/20' : 'bg-orange-200/30'}`}></div>
      </div>

      {/* Watermark */}
      <div 
        className={`fixed inset-0 pointer-events-none z-0 bg-center bg-no-repeat bg-contain transition-opacity duration-500 ${isDark ? 'opacity-[0.03] invert' : 'opacity-[0.05]'}`}
        style={{ backgroundImage: `url(${scalesBgUrl})` }}
      ></div>

      <div className="relative z-10">
        <Navbar />
        
        {/* 1. HERO SECTION */}
        <HeroSection />

        {/* 2. TRUST STRIP (Keep this, it's good) */}
        <div className={`py-12 border-y ${isDark ? 'bg-white/5 border-white/5' : 'bg-white/50 border-orange-100'}`}>
          <div className="max-w-7xl mx-auto px-6 text-center">
            <p className={`text-xs font-bold uppercase tracking-widest mb-10 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Trusted by Public Safety Departments
            </p>
            {/* ... Trust Logos Code (Keep what you have) ... */}
            <div className="flex flex-wrap justify-center items-center gap-16 opacity-60">
  
            <div className="flex flex-col items-center">
                <img src="/delhi.png" alt="Delhi Police" className="h-16 mb-2" />
                <span className="font-serif font-bold text-2xl">Delhi Police</span>
            </div>

            <div className="flex flex-col items-center">
                <img src="/barcouncil.png" alt="Bar Council" className="h-16 mb-2" />
                <span className="font-serif font-bold text-2xl">Bar Council</span>
            </div>

            <div className="flex flex-col items-center">
                <img src="/niti.jpeg" alt="NITI Aayog" className="h-16 mb-2" />
                <span className="font-serif font-bold text-2xl">NITI Aayog</span>
            </div>

            </div>

          </div>
        </div>

        {/* 3. NEW BENTO GRID (Replaces "System Modules" & "Problem/Solution") */}
        <LegalBentoGrid />

        {/* 4. CALL TO ACTION */}
        <section className="py-32 px-6 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-serif-heading font-bold mb-8">Ready to claim your rights?</h2>
            <p className={`text-xl mb-12 max-w-2xl mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Join 10,000+ citizens using NyayaSahayak to navigate the legal system with confidence.
            </p>
            <button className="px-12 py-6 bg-slate-900 hover:bg-black text-white rounded-full font-bold text-xl shadow-2xl hover:-translate-y-1 transition-all">
              Get Started Now
            </button>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
};

export default LandingPage;