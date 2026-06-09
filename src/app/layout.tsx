
import type { Metadata } from 'next';
import { cn } from '@/lib/utils';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/hooks/use-auth-provider';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';


export const metadata: Metadata = {
  title: 'LEBAREF',
  description: 'Expertos en gestión y mantenimiento de equipos a través de nuestro CRM.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="https://lebaref.com/favicon.ico" type="image/x-icon" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('font-body antialiased bg-background')}>
        <AuthProvider>
            <div className="flex flex-col min-h-screen">
                
                <main className="flex-grow">
                    {children}
                </main>
            </div>
            <Toaster />
            <FirebaseErrorListener />
        </AuthProvider>
      </body>
    </html>
  );
}
