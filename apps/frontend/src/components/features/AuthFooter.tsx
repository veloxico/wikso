export function AuthFooter() {
  return (
    <p className="text-xs text-muted-foreground">
      &copy; {new Date().getFullYear()}{' '}
      <a
        href="https://veloxico.com"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:underline"
      >
        veloxico.com
      </a>
    </p>
  );
}
