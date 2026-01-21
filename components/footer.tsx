export function Footer() {
  return (
    <footer className="flex items-center justify-center p-4 pb-8 w-full">
      <p className="text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} NYCU Winlab.
      </p>
    </footer>
  );
}
