
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, ShieldCheck, Wrench as InstallIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import React, { Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Service } from '@/components/admin/service-manager';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';


const serviceCategories = {
  correctivo: {
    title: "Mantenimiento Correctivo",
    description: "Servicios enfocados en reparar averías o fallos cuando ocurren, minimizando así el tiempo de inactividad de sus equipos. Respuesta rápida para emergencias.",
    icon: <Zap className="w-8 h-8 text-primary" />,
  },
  preventivo: {
    title: "Mantenimiento Preventivo",
    description: "Consiste en realizar inspecciones regulares y tareas de mantenimiento programadas para garantizar que los equipos funcionen correctamente y evitar fallos futuros.",
    icon: <ShieldCheck className="w-8 h-8 text-primary" />,
  },
  instalacion: {
    title: "Instalación de Equipos",
    description: "Ofrecemos servicios expertos para la instalación y configuración inicial de sus equipos de cocina, asegurando un arranque perfecto y conforme a las normativas.",
    icon: <InstallIcon className="w-8 h-8 text-primary" />,
  }
};

type ServiceType = keyof typeof serviceCategories;


function ServiceTypePageContent() {
  const { serviceType } = useParams();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const serviceInfo = serviceCategories[serviceType as ServiceType];

  useEffect(() => {
    if (!serviceType) return;
    
    setIsLoading(true);
    const q = query(collection(db, "services"), where("serviceType", "==", serviceType as string));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const servicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
        setServices(servicesData);
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: "services",
            operation: 'list',
        }));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [serviceType]);

  if (!serviceInfo) {
    notFound();
  }

  if (isLoading) {
    return <LoadingComponent />;
  }

  return (
    <div className="container mx-auto px-4 py-16">
       <section>
            <div className="flex items-center gap-4 mb-8">
                <div className="bg-primary/10 p-3 rounded-full">{serviceInfo.icon}</div>
                <h1 className="text-3xl md:text-4xl font-headline font-bold">{serviceInfo.title}</h1>
            </div>
            <p className="text-muted-foreground max-w-3xl mb-8">
                {serviceInfo.description}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {services.length > 0 ? services.map((service) => (
                    <Card key={service.id} className="flex flex-col hover:shadow-xl transition-shadow duration-300">
                        <CardHeader>
                            <CardTitle>{service.title}</CardTitle>
                            <CardDescription className="text-primary font-bold text-lg pt-2">${parseFloat(service.price as any).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <p className="text-muted-foreground">{service.description}</p>
                        </CardContent>
                        <CardFooter>
                            <Button asChild className="w-full bg-accent hover:bg-accent/90">
                                <Link href={`/tickets/new?serviceType=${serviceType}&equipmentType=${encodeURIComponent(service.title)}&price=${service.price}`}>
                                    Solicitar Servicio
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                )) : (
                    <p className="text-muted-foreground col-span-full">No hay servicios disponibles en esta categoría por el momento.</p>
                )}
            </div>
        </section>
        <div className="mt-16 text-center">
            <Button variant="outline" asChild>
                <Link href="/services"> &larr; Volver a Categorías de Servicio</Link>
            </Button>
        </div>
    </div>
  );
}

function LoadingComponent() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function ServiceTypePage() {
  return (
    <Suspense fallback={<LoadingComponent />}>
      <ServiceTypePageContent />
    </Suspense>
  )
}
