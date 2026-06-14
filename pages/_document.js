import { Html, Head, Main, NextScript } from "next/document";

// Inlined and run synchronously before React hydrates to avoid a flash
// of the wrong theme. Reads the persisted preference, falls back to the
// system preference, and sets data-theme on <html>.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('market-current-theme');
    var theme = stored;
    if (theme !== 'light' && theme !== 'dark') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
