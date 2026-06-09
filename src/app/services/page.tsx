
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldCheck, Wrench } from 'lucide-react';
import Link from 'next/link';

export default function ServicesLandingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">Explore Nuestros Servicios</h1>
        <p className="text-lg text-muted-foreground">
          Ofrecemos soluciones integrales para el cuidado y funcionamiento óptimo de su equipo gastronómico. Elija una categoría para ver los servicios detallados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {/* Mantenimiento Correctivo Card */}
        <Card className="flex flex-col text-center hover:shadow-xl transition-shadow duration-300 p-6">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Zap className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl">Mantenimiento Correctivo</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-muted-foreground">
              Se enfoca en reparar averías o fallos cuando ocurren, minimizando así el tiempo de inactividad de sus equipos. Ofrecemos una respuesta rápida para solucionar sus emergencias y problemas inesperados.
            </p>
            <Button asChild size="lg" className="bg-accent hover:bg-accent/90">
              <Link href="/services/correctivo">Ver Servicios Correctivos</Link>
            </Button>
          </CardContent>
        </Card>

        {/* Mantenimiento Preventivo Card */}
        <Card className="flex flex-col text-center hover:shadow-xl transition-shadow duration-300 p-6">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl">Mantenimiento Preventivo</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-muted-foreground">
              Consiste en realizar inspecciones regulares y tareas de mantenimiento programadas para garantizar que los equipos funcionen correctamente, prevenir fallos futuros y alargar su vida útil.
            </p>
            <Button asChild size="lg">
              <Link href="/services/preventivo">Ver Servicios Preventivos</Link>
            </Button>
          </CardContent>
        </Card>
        
        {/* Instalación Card */}
        <Card className="flex flex-col text-center hover:shadow-xl transition-shadow duration-300 p-6">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                <Wrench className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="font-headline text-2xl">Instalación de Equipos</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow space-y-4">
            <p className="text-muted-foreground">
              Servicios profesionales para la instalación y puesta en marcha de nuevos equipos de cocina, garantizando su correcto funcionamiento desde el primer día.
            </p>
            <Button asChild size="lg" variant="secondary">
              <Link href="/services/instalacion">Ver Servicios de Instalación</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    