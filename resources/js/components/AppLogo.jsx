export function AppLogo({ className = '', alt = 'BakhMail' }) {
  return <img src="/bakhmail-logo.png" alt={alt} className={`app-logo ${className}`.trim()} />;
}
