
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, User, List } from 'lucide-react';
import { Logo } from '@/components/logo';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import React, { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';

const navLinks = [
  { href: '/about', label: 'Nosotros' },
  { href: '/services', label: 'Servicios' },
  { href: '/contact', label: 'Contacto' },
];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const { user, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // This should match any page that is part of the "public" site experience
  const isPublicPage = ['/', '/about', '/services', '/contact', '/faq', '/quote', '/tickets/new', '/signup', '/login'].includes(pathname) || pathname.startsWith('/services/');


  useEffect(() => {
    if (isLoading || !user) {
      setIsAdmin(false);
      return;
    }

    const checkAdminRole = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("Could not check admin role:", error);
        setIsAdmin(false);
      }
    };

    if (user) {
      checkAdminRole();
    }
  }, [user, isLoading]);


  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/');
  };

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">Mi Cuenta</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">Mi Panel</Link>
        </DropdownMenuItem>
         <DropdownMenuItem asChild>
          <Link href="/profile/my-tickets">Mis Tickets</Link>
        </DropdownMenuItem>
        {isAdmin && (
           <DropdownMenuItem asChild>
             <Link href="/admin">Panel de Admin</Link>
           </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
  
  if (!isPublicPage) {
    return null; // The header is not rendered on internal pages like /profile, /admin etc.
  }
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 items-center px-4">
        <div className="flex items-center gap-6">
          <Logo />
        </div>

        <nav className="hidden md:flex items-center justify-center gap-6 mx-auto">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === link.href ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center justify-end gap-2 ml-auto">
          {isLoading ? null : user ? (
            <UserMenu />
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/">Iniciar Sesión</Link>
              </Button>
              <Button asChild className="bg-accent hover:bg-accent/90">
                <Link href="/signup">Registrarse</Link>
              </Button>
            </>
          )}
        </div>

        <div className="md:hidden ml-auto flex items-center gap-2">
            {user && <UserMenu />}
            <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                    <Menu className="h-4 w-4" />
                    <span className="sr-only">Abrir menú</span>
                </Button>
                </SheetTrigger>
                <SheetContent side="right">
                <div className="flex flex-col h-full">
                    <div className="p-4 border-b">
                    <Logo />
                    </div>
                    <nav className="flex flex-col gap-4 p-4">
                    {navLinks.map((link) => (
                        <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setSheetOpen(false)}
                        className={cn(
                            'text-lg font-medium transition-colors hover:text-primary',
                            pathname === link.href ? 'text-primary' : 'text-foreground'
                        )}
                        >
                        {link.label}
                        </Link>
                    ))}
                    </nav>
                    <div className="mt-auto p-4 border-t flex flex-col gap-4">
                    {isLoading ? null : user ? (
                        null
                    ) : (
                        <div className="flex flex-col gap-2">
                        <Button variant="outline" asChild className="w-full">
                            <Link href="/" onClick={() => setSheetOpen(false)}>Iniciar Sesión</Link>
                        </Button>
                        <Button asChild className="bg-accent hover:bg-accent/90 w-full">
                            <Link href="/signup" onClick={() => setSheetOpen(false)}>Registrarse</Link>
                        </Button>
                        </div>
                    )}
                    </div>
                </div>
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
}
