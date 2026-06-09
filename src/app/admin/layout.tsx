
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Briefcase, FileText, Users, ShoppingCart, Truck, User, LogOut, Menu, Wrench, Package, Calendar, AreaChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

type UserProfile = {
    role: 'admin' | 'employee';
    permissions?: { [key: string]: boolean };
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
    const pathname = usePathname();
    const { user, isLoading: authIsLoading } = useAuth();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isProfileLoading, setIsProfileLoading] = useState(true);

    useEffect(() => {
        if (authIsLoading) return;
        if (!user) {
            router.push('/');
            return;
        }

        setIsProfileLoading(true);
        const docRef = doc(db, "users", user.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(docSnap.data() as UserProfile);
            } else {
                console.error("User profile document not found!");
                setUserProfile(null);
            }
            setIsProfileLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'get',
            }));
            setIsProfileLoading(false);
        });

        return () => unsubscribe();
    }, [user, authIsLoading, router]);

    const hasAccess = (module: string) => {
        if (userProfile?.role === 'admin') return true;
        return userProfile?.permissions?.[module] ?? false;
    };

    const mainLinks = [
        { href: "/admin", label: "Inicio", icon: Home, id: "dashboard", exact: true },
        { href: "/admin/projects", label: "Proyectos", icon: Briefcase, id: "projects" },
    ].filter(link => hasAccess(link.id) || link.id === 'dashboard');
    
    const salesLinks = [
        { href: "/admin/quotes", label: "Cotizaciones", icon: FileText, id: "quotes" },
        { href: "/admin/clients", label: "Clientes", icon: Users, id: "clients" },
    ].filter(link => hasAccess(link.id));
    
    const purchasesLinks = [
        { href: "/admin/purchase-orders", label: "Órdenes de Compra", icon: ShoppingCart, id: "purchase_orders" },
        { href: "/admin/suppliers", label: "Proveedores", icon: Truck, id: "suppliers" },
    ].filter(link => hasAccess(link.id));
    
    const warehouseLinks = [
        { href: "/admin/services", label: "Servicios", icon: Wrench, id: "services" },
        { href: "/admin/spare-parts", label: "Refacciones", icon: Package, id: "spare_parts" },
    ].filter(link => hasAccess(link.id));

    const toolsLinks = [
        { href: "/admin/calendar", label: "Calendario", icon: Calendar, id: "calendar"},
        { href: "/admin/reports", label: "Reportes", icon: AreaChart, id: "reports" }
    ].filter(link => hasAccess(link.id));

    const adminControlLink = { href: "/admin/users", label: "Control de Usuarios", icon: User, id: "users" };
    
    const allNavLinks = [
        ...mainLinks,
        ...salesLinks,
        ...purchasesLinks,
        ...warehouseLinks,
        ...toolsLinks,
        ...(hasAccess(adminControlLink.id) ? [adminControlLink] : [])
    ];

    const handleSignOut = async () => {
        await auth.signOut();
        router.push('/');
    };

    const isActive = (href: string, exact = false) => {
        if (exact) return pathname === href;
        return pathname.startsWith(href);
    }

    const NavLink = ({ link, isMobile = false }: { link: { href: string, label: string, icon: React.ElementType, exact?: boolean }, isMobile?: boolean}) => (
         <Link
            href={link.href}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
                isActive(link.href, link.exact) ? "bg-muted text-primary" : "text-muted-foreground",
                 isMobile && `gap-4 rounded-xl text-foreground hover:text-foreground mx-[-0.65rem] ${isActive(link.href, link.exact) ? "bg-muted" : ""}`
            )}
        >
            <link.icon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
            {link.label}
        </Link>
    );

    const NavGroup = ({ title, links, isMobile = false }: { title: string, links: any[], isMobile?: boolean }) => {
        if (links.length === 0) return null;
        return (
            <div className="py-2">
                {!isMobile && <h3 className="mb-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>}
                {links.map((link) => <NavLink key={link.href} link={link} isMobile={isMobile} />)}
            </div>
        );
    }
    
    if (authIsLoading || isProfileLoading) {
        return (
          <div className="flex h-screen w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        );
    }

    return (
        <div className="grid h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <div className="hidden border-r bg-muted/40 md:block">
            <div className="flex h-full max-h-screen flex-col gap-2">
            <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                <Logo href="/admin" />
            </div>
            <div className="flex-1 overflow-auto py-2">
                <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                {mainLinks.map((link) => <NavLink key={link.href} link={link} />)}
                <NavGroup title="Ventas" links={salesLinks} />
                <NavGroup title="Compras" links={purchasesLinks} />
                <NavGroup title="Almacenes" links={warehouseLinks} />
                <NavGroup title="Herramientas" links={toolsLinks} />
                </nav>
            </div>
                <div className="mt-auto p-4">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        {hasAccess(adminControlLink.id) && (
                            <NavLink link={adminControlLink} />
                        )}
                    </nav>
                </div>
            </div>
        </div>
        <div className="flex flex-col h-screen overflow-hidden">
            <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 shrink-0">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button
                        variant="outline"
                        size="icon"
                        className="shrink-0 md:hidden"
                        >
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Abrir/cerrar menú de navegación</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="flex flex-col p-0">
                        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                            <Logo href="/admin" />
                        </div>
                        <nav className="grid gap-2 text-lg font-medium p-4">
                            {allNavLinks.map((link) => <NavLink key={link.href} link={link} isMobile={true} />)}
                        </nav>
                    </SheetContent>
                </Sheet>
                <div className="w-full flex-1">
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="rounded-full">
                        <Avatar className="h-8 w-8">
                        <AvatarFallback>
                            <User className="h-5 w-5" />
                        </AvatarFallback>
                        </Avatar>
                        <span className="sr-only">Abrir/cerrar menú de usuario</span>
                    </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/profile')}>Perfil</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Cerrar Sesión
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>
            <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
            </main>
        </div>
        </div>
    );
}
