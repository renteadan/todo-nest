'use client';

const dark = '(prefers-color-scheme: dark)';
const systemTheme = () => (matchMedia(dark).matches ? 'dark' : 'light');

/**
 * Pins light or dark over the system theme. Picking the theme the system
 * already shows drops the pin, so the app follows the system again.
 */
export function ThemeSwitch() {
  return (
    <label className="menu-item cursor-pointer select-none">
      Dark mode
      <input
        type="checkbox"
        role="switch"
        className="switch"
        // The theme lives on <html>, not in React state: sync on mount and
        // when the system theme flips.
        ref={(el) => {
          if (!el) return;
          const media = matchMedia(dark);
          const sync = () => {
            el.checked =
              (document.documentElement.dataset.theme ?? systemTheme()) ===
              'dark';
          };
          sync();
          media.addEventListener('change', sync);
          return () => media.removeEventListener('change', sync);
        }}
        onChange={(e) => {
          const theme = e.target.checked ? 'dark' : 'light';
          const root = document.documentElement;
          try {
            if (theme === systemTheme()) {
              delete root.dataset.theme;
              localStorage.removeItem('theme');
            } else {
              root.dataset.theme = theme;
              localStorage.setItem('theme', theme);
            }
          } catch {
            // Storage blocked: the choice still holds for this page.
            root.dataset.theme = theme;
          }
        }}
      />
    </label>
  );
}
