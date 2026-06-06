import { useTheme } from '../lib/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
      className="relative flex h-7 w-14 shrink-0 items-center rounded-full bg-slate-200 p-0.5 transition-colors duration-200 dark:bg-slate-600"
    >
      {/* Sliding pill */}
      <span
        className={`absolute h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isDark ? 'translate-x-7' : 'translate-x-0'
        }`}
      />
      {/* Sun — left */}
      <span className="relative z-10 flex h-6 w-6 items-center justify-center text-[11px] leading-none select-none">
        ☀️
      </span>
      {/* Moon — right */}
      <span className="relative z-10 flex h-6 w-6 items-center justify-center text-[11px] leading-none select-none">
        🌙
      </span>
    </button>
  );
}
