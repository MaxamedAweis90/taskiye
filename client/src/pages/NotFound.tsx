import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Compass, CheckSquare, Repeat, Trophy } from 'lucide-react';
import { SEOHead } from '../components/common/SEOHead';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen min-h-[100dvh] w-full bg-[#f8fafc] text-slate-900 dark:bg-[#070D19] dark:text-slate-100 px-4 py-8 select-none font-sans overflow-hidden antialiased">
      <SEOHead
        title="404 - Page Not Found | Taskiye"
        description="The page you are looking for does not exist on Taskiye."
        canonicalPath="/404"
      />

      {/* Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-amber-500/[0.08] dark:bg-amber-400/[0.07] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-[400px] h-[400px] bg-blue-600/[0.06] dark:bg-blue-500/[0.05] rounded-full blur-[100px] pointer-events-none" />

      {/* Top Taskiye Brand Logo */}
      <Link
        to="/"
        className="group relative flex items-center justify-center mb-6 transition-transform duration-200 hover:scale-105 z-10"
        title="Taskiye Home"
      >
        <img
          src="/logo.png"
          alt="Taskiye Logo"
          className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_16px_rgba(250,204,21,0.3)]"
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML =
                '<span class="text-amber-500 dark:text-amber-400 font-extrabold text-3xl">⚡</span>';
            }
          }}
        />
      </Link>

      {/* Minimalist Card Container */}
      <div className="relative w-full max-w-lg rounded-3xl bg-white/95 dark:bg-[#10192D]/90 border border-slate-200/80 dark:border-white/[0.08] p-8 sm:p-12 text-center backdrop-blur-2xl shadow-2xl dark:shadow-[0_16px_48px_rgba(0,0,0,0.6)] overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-300">
        {/* Subtle Ambient Glow inside Card */}
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Minimal Icon Badge */}
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mb-5 shadow-inner">
          <Compass className="w-7 h-7 stroke-[1.75]" />
        </div>

        {/* 404 Numerals */}
        <div className="text-6xl sm:text-7xl font-black tracking-tight text-slate-900 dark:text-white mb-2">
          404
        </div>

        {/* Heading & Subtitle */}
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight mb-2">
          Page not found
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-md mx-auto mb-8 leading-relaxed">
          The link you followed may be broken, or the page may have been removed. Let's get you back on track.
        </p>

        {/* Primary Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto mb-8">
          <button
            type="button"
            onClick={handleGoBack}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 dark:bg-[#182338] dark:hover:bg-[#1F2E4A] dark:border-white/[0.08] dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>

          <Link
            to="/"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </Link>
        </div>

        {/* Minimal Quick Links */}
        <div className="pt-6 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Quick Navigation
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/habits"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <Repeat className="w-3.5 h-3.5 text-amber-500" />
              <span>Habits</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <Link
              to="/tasks"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Tasks</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <Link
              to="/rank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
            >
              <Trophy className="w-3.5 h-3.5 text-emerald-500" />
              <span>Leaderboard</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
