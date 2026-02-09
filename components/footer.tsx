export function Footer() {
  return (
    <footer className="fixed bottom-4 right-4 z-50">
      <span className="text-md text-muted-foreground">
        © {new Date().getFullYear()} Winlab.
      </span>
    </footer>
  );
}
