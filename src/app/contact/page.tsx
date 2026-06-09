import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <Mail className="w-16 h-16 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">
          Contacto
        </h1>
        <p className="text-lg text-muted-foreground">
          Estamos aquí para ayudarte. Ponte en contacto con nosotros a través de cualquiera de los siguientes medios.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold font-headline mb-4">Información de Contacto</h2>
            <div className="space-y-4 text-muted-foreground">
              <div className="flex items-center gap-4">
                <MapPin className="w-6 h-6 text-primary" />
                <span>Calle Ficticia 123, Col. Centro, Mérida, Yucatán, México</span>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="w-6 h-6 text-primary" />
                <span>(999) 123-4567</span>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="w-6 h-6 text-primary" />
                <span>contacto@sticgsa.com</span>
              </div>
            </div>
          </div>
           <div>
            <h2 className="text-2xl font-bold font-headline mb-4">Horario de Atención</h2>
            <div className="space-y-2 text-muted-foreground">
                <p>Lunes a Viernes: 9:00 AM - 6:00 PM</p>
                <p>Sábados: 9:00 AM - 1:00 PM</p>
                <p>Domingos: Cerrado</p>
                <p className="font-semibold text-primary">Servicio de emergencia 24/7 disponible.</p>
            </div>
          </div>
        </div>

        <div>
            <h2 className="text-2xl font-bold font-headline mb-4">Envíanos un Mensaje</h2>
             <form className="space-y-4">
                <Input type="text" placeholder="Nombre Completo" required />
                <Input type="email" placeholder="Correo Electrónico" required />
                <Input type="text" placeholder="Asunto" required />
                <Textarea placeholder="Escribe tu mensaje aquí..." required className="min-h-[150px]" />
                <Button type="submit" className="w-full">Enviar Mensaje</Button>
            </form>
        </div>
      </div>
    </div>
  );
}
