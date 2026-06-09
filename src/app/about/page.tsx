
import { Building, Award, Users } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const stats = [
  {
    icon: <Award className="w-8 h-8 text-primary" />,
    value: "30+",
    label: "Años de Experiencia",
  },
  {
    icon: <Users className="w-8 h-8 text-primary" />,
    label: "Técnicos Especialistas",
    value: "15+",

  },
  {
    icon: <Building className="w-8 h-8 text-primary" />,
    label: "Clientes Satisfechos",
    value: "500+",
  },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="py-20 md:py-24 bg-card">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-headline text-4xl md:text-6xl font-bold tracking-tighter">
            Sobre Nosotros
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-muted-foreground">
            Conoce la historia, misión y valores que nos convierten en líderes del servicio técnico.
          </p>
        </div>
      </section>

      <section className="py-24">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
           <div className="relative h-80 md:h-full min-h-[400px] rounded-lg overflow-hidden shadow-2xl">
            <Image
              src="https://ucarecdn.com/3336978a-7b33-42e1-a423-02631b746583/aaaIMG_6564.jpg"
              alt="Taller de LEBAREF"
              data-ai-hint="workshop tools"
              fill
              className="object-cover"
            />
          </div>
          <div className="space-y-6">
            <h2 className="font-headline text-3xl md:text-4xl font-bold">Nuestra Trayectoria</h2>
            <p className="text-muted-foreground font-semibold">
              Expertos en servicios para estufas, freidoras, campanas, hornos y refrigeradores.
            </p>
            <p className="text-muted-foreground">
              En LEBAREF tenemos más de 30 años de experiencia dentro del ramo industrial, brindando los mejores servicios de reparación, mantenimiento preventivo y correctivo de diferentes equipos de cocina industrial. Nos ubicamos en la Ciudad de Mérida Yucatán.
            </p>
            <p className="text-muted-foreground">
              Atendemos de manera integral cada una de las necesidades y requerimientos de nuestros clientes, ofrecemos soluciones técnicas asertivas en el manejo, diagnóstico y reparación de distintos equipos de cocina. Disponemos de la infraestructura comercial necesaria para la resolución efectiva de cada servicio.
            </p>
             <p className="text-muted-foreground">
              Manejamos excelentes relaciones comerciales permitiéndonos ofrecer soluciones prácticas a la medida de manera rápida y oportuna. Nuestro personal es profesional, está capacitado y son especialistas para la realización de cualquier servicio, trabajando con las marcas más importantes del mercado.
            </p>
          </div>
        </div>
      </section>
      
       <section className="py-24 bg-card">
        <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-12">
                 <h2 className="font-headline text-3xl md:text-4xl font-bold">Compromiso y Calidad en Cifras</h2>
                 <p className="mt-4 text-muted-foreground">Nuestra experiencia y dedicación se reflejan en nuestro trabajo diario.</p>
            </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index} className="p-6 rounded-lg">
                <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                    {stat.icon}
                </div>
                <p className="text-4xl font-bold text-primary">{stat.value}</p>
                <p className="text-muted-foreground mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
           <div className="text-center mt-16">
                 <Button asChild size="lg">
                    <Link href="/contact">Ponte en Contacto con Nosotros</Link>
                 </Button>
            </div>
        </div>
      </section>

    </div>
  );
}
