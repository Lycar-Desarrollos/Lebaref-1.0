
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Ticket } from '@/components/admin/ticket-table';
import { TicketDetails } from '@/components/admin/ticket-details';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const router = useRouter();
  const { user, isLoading: authIsLoading } = useAuth();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (!ticketId) return;

    setIsLoading(true);
    const docRef = doc(db, 'tickets', ticketId as string);

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setTicket({ id: docSnap.id, ...docSnap.data() } as Ticket);
        setError(null);
      } else {
        setError('No se encontró el ticket.');
        setTicket(null);
      }
      setIsLoading(false);
    }, (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'get',
      }));
      setError('Error al cargar el ticket.');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [ticketId, user, authIsLoading, router]);

  if (authIsLoading || isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-theme(spacing.16))] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-[calc(100vh-theme(spacing.16))] items-center justify-center text-center">
        <p className="text-lg text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.back()} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>
      </div>
    );
  }

  if (!ticket) {
    return null; // Should be covered by error state, but good practice
  }

  return (
    <div className="container mx-auto px-4 py-10">
        <Button variant="outline" onClick={() => router.push('/admin')} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Panel de Administración
        </Button>
        <TicketDetails ticket={ticket} />
    </div>
  );
}
