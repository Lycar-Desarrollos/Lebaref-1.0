import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { HelpCircle } from 'lucide-react';

const faqs = [
  {
    question: '¿Cómo puedo levantar un nuevo ticket de servicio?',
    answer:
      'Puedes levantar un nuevo ticket navegando a la sección "Crear Ticket" desde el menú de tu perfil o el pie de página. Deberás llenar detalles sobre el tipo de servicio, el equipo, una descripción del problema y el nivel de urgencia. Una vez enviado, nuestro equipo lo revisará a la brevedad.',
  },
  {
    question: '¿Cuáles son los tiempos de respuesta?',
    answer:
      'Los tiempos de respuesta varían según la prioridad de tu ticket. Los tickets de alta prioridad se atienden típicamente en 1-2 horas, los de prioridad media en 4-6 horas y los de baja prioridad en 24 horas. Estos son estimados y pueden variar según la carga de trabajo actual.',
  },
  {
    question: '¿Cómo puedo revisar el estado de mi ticket?',
    answer:
      'Una vez que hayas iniciado sesión en tu cuenta, podrás visitar una futura sección de "Mis Tickets" para ver una lista de todos tus tickets enviados y su estado actual (ej., Recibido, En Progreso, Resuelto). También recibirás notificaciones por correo electrónico sobre cambios importantes en el estado.',
  },
  {
    question: '¿Qué tipos de equipos de cocina reparan?',
    answer:
      'Damos servicio a una amplia gama de equipos de cocina industrial y comercial, incluyendo estufas, hornos, freidoras, campanas de extracción, refrigeradores, congeladores y más. Trabajamos con las principales marcas del mercado.',
  },
  {
    question: '¿Cómo solicito una cotización para un servicio específico?',
    answer:
      'Puedes solicitar una cotización visitando la página "Solicitar Cotización". Proporciona la mayor cantidad de detalles posible sobre tus necesidades para que podamos darte un estimado preciso. Nuestro equipo te responderá con una cotización detallada.',
  },
  {
    question: '¿Ofrecen servicios de reparación de emergencia?',
    answer:
      'Sí, ofrecemos servicios de reparación de emergencia 24/7 para problemas críticos. Por favor, marca tu ticket como de "Alta" urgencia o llama a nuestra línea directa de emergencia para asistencia inmediata.',
  },
];

export default function FaqPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <HelpCircle className="w-16 h-16 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">
          Preguntas Frecuentes
        </h1>
        <p className="text-lg text-muted-foreground">
          Encuentra respuestas a preguntas comunes sobre nuestros servicios y procesos.
        </p>
      </div>
      <div className="max-w-3xl mx-auto">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left font-semibold text-lg hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
