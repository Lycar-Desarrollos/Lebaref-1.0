
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, orderBy, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, Ticket as TicketIcon, PlusCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Ticket = {
  id: string;
  serviceType: "correctivo" | "preventivo";
  equipmentType: string;
  description: string;
  urgency: "baja" | "media" | "alta";
  status: "Recibido" | "En Progreso" | "Resuelto";
  createdAt: Timestamp;
  quantity?: number;
};

export default function MyTicketsPage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchTickets = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "tickets"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const userTickets = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
        setTickets(userTickets);
      } catch (error) {
        console.error("Error fetching tickets: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTickets();
  }, [user, authIsLoading, router]);

  const UrgencyBadge = ({ urgency }: { urgency: string }) => (
    <Badge variant="outline" className={cn(
      urgency === 'alta' && 'border-red-500 text-red-500',
      urgency === 'media' && 'border-yellow-500 text-yellow-500',
      urgency === 'baja' && 'border-green-500 text-green-500'
    )}>
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </Badge>
  );

  const StatusBadge = ({ status }: { status: string }) => (
     <Badge variant={status === 'Resuelto' ? 'secondary' : 'default'} className={cn(
        'text-white',
        status === 'Recibido' && 'bg-blue-500',
        status === 'En Progreso' && 'bg-yellow-500 text-black',
        status === 'Resuelto' && 'bg-green-500'
      )}>{status}</Badge>
  );

  if (authIsLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">Cargando tus tickets...</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-16">
       <Card>
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
                <TicketIcon className="w-8 h-8 text-primary"/>
                <CardTitle className="text-3xl font-headline">Mis Tickets de Servicio</CardTitle>
            </div>
            <CardDescription>Aquí puedes ver el historial y estado de todas tus solicitudes de servicio.</CardDescription>
          </div>
          <Button asChild>
            <Link href="/tickets/new">
                <PlusCircle className="mr-2 h-4 w-4"/>
                Crear Nuevo Ticket
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
           <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Urgencia</TableHead>
                    <TableHead>Tipo Servicio</TableHead>
                    <TableHead>Fecha de Creación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.length > 0 ? (
                    tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">{ticket.equipmentType}</TableCell>
                        <TableCell><StatusBadge status={ticket.status} /></TableCell>
                        <TableCell><UrgencyBadge urgency={ticket.urgency} /></TableCell>
                        <TableCell>{ticket.serviceType === 'correctivo' ? 'Correctivo' : 'Preventivo'}</TableCell>
                        <TableCell>{ticket.createdAt.toDate().toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No has creado ningún ticket todavía.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
