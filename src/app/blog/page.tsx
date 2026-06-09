
import { Rss } from 'lucide-react';

export default function BlogPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <Rss className="w-16 h-16 mx-auto text-primary mb-4" />
        <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">
          Nuestro Blog
        </h1>
        <p className="text-lg text-muted-foreground">
          Artículos, noticias y consejos de nuestros expertos. Próximamente.
        </p>
      </div>
    </div>
  );
}
