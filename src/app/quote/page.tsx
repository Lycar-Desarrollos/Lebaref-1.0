
import { QuoteForm } from '@/components/forms/quote-form';
import { FileText } from 'lucide-react';

export default function RequestQuotePage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <FileText className="w-16 h-16 mx-auto text-primary mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">
            Solicitar una Cotización
          </h1>
          <p className="text-lg text-muted-foreground">
            Cuéntenos sobre sus necesidades y le proporcionaremos una cotización detallada y sin compromiso.
          </p>
        </div>
        <div className="bg-card p-8 rounded-lg shadow-lg">
          <QuoteForm />
        </div>
      </div>
    </div>
  );
}
