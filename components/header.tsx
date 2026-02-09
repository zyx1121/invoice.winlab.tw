
import Link from "next/link";

export function Header() {
  return (
    <header className="fixed top-4 left-4 z-50">
      <Link href="/" className="text-3xl text-muted-foreground">
        Invoice
      </Link>
    </header>
  );
}
