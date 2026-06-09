import Link from 'next/link';
import { Logo } from '@/components/logo';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-card">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <Logo />
            <p className="text-sm text-muted-foreground">
              &copy; {currentYear} LEBAREF. Todos los derechos reservados.
            </p>
          </div>
          <nav className="flex flex-wrap justify-center gap-4 md:gap-6">
             <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Nosotros
            </Link>
            <Link href="/services" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Servicios
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Contacto
            </Link>
            <Link href="/tickets/new" className="text-sm text-muted-foreground hover:text-primary transition-colors">
              Crear Ticket
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
