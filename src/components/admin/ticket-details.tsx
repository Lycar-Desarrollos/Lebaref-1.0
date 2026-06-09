

"use client";

import { Ticket } from "@/components/admin/ticket-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { Download, ChevronDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

type TicketDetailsProps = {
  ticket: Ticket;
};

const downloadServiceOrderPDF = async (ticket: Ticket) => {
    const doc = new jsPDF();
    const ticketId = ticket.ticketNumber ? `ORD-${String(ticket.ticketNumber).padStart(3, '0')}` : ticket.id;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const pageMargin = 14;
    const bottomMargin = 50;

    let logoDataUrl: string | null = null;
    try {
        const logoUrl = 'https://res.cloudinary.com/ddbgqzdpj/image/upload/v1771958796/logo-Photoroom_klbk3u.png';
        const response = await fetch(logoUrl);
        const blob = await response.blob();
        logoDataUrl = await new Promise<string>(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("Error loading logo for PDF:", error);
    }

    const drawHeader = () => {
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', pageMargin, 8, 40, 15);
        } else {
            doc.setFont("helvetica", "bold").setFontSize(20).text("LEBAREF", pageMargin, 15);
        }
        
        doc.setFont("helvetica", "normal").setFontSize(10).text("Orden de Servicio", pageMargin, 15 + 5);
        doc.setFont("helvetica", "bold").setFontSize(12).text(`Orden #${ticketId}`, pageWidth - pageMargin, 15, { align: 'right' });
        doc.setFont("helvetica", "normal").setFontSize(10).text(`Fecha: ${ticket.createdAt?.toDate().toLocaleDateString('es-MX') || "N/A"}`, pageWidth - pageMargin, 15 + 5, { align: 'right' });
        doc.setDrawColor(221, 221, 221).line(pageMargin, 15 + 10, pageWidth - pageMargin, 15 + 10);
    };

    drawHeader();
    
    autoTable(doc, {
      startY: 35,
      body: [
        [{ content: 'CLIENTE', styles: { fontStyle: 'bold', fillColor: [41, 71, 121], textColor: 255 } }, { content: 'DETALLES DEL SERVICIO', styles: { fontStyle: 'bold', fillColor: [41, 71, 121], textColor: 255 } }],
        [{ content: `Nombre: ${ticket.clientName}\nDirección: ${ticket.clientAddress}\nTeléfono: ${ticket.clientPhone}`, styles: { cellWidth: 91 } }, { content: `Tipo: ${ticket.serviceType}\nEquipo: ${ticket.equipmentType}\nUrgencia: ${ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)}`, styles: { cellWidth: 91 } }]
      ],
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      margin: { bottom: bottomMargin }
    });

    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        body: [
            [{ content: 'Descripción del Problema / Necesidad:', styles: { fontStyle: 'bold' }}],
            [{ content: ticket.description }]
        ],
        theme: 'grid',
        styles: { fontSize: 8, overflow: 'linebreak' },
        margin: { bottom: bottomMargin }
    });

     autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        body: [
            [{ content: 'Notas del Técnico:', styles: { fontStyle: 'bold' }}],
            [{ content: `\n\n\n\n`, styles: { minCellHeight: 30 } }]
        ],
        theme: 'grid',
        styles: { fontSize: 8 },
        margin: { bottom: bottomMargin }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setTextColor(150).text(`Página ${i} de ${totalPages}`, pageWidth - pageMargin, pageHeight - 10, { align: 'right' });
    }

    doc.setPage(totalPages);
    const signatureY = pageHeight - 40;
    doc.setDrawColor(150, 150, 150);
    doc.line(20, signatureY, 80, signatureY);
    doc.setFontSize(9).setTextColor(100).text("Firma del Cliente", 50, signatureY + 5, { align: 'center' });
    doc.line(116, signatureY, 176, signatureY);
    doc.text("Firma del Técnico", 146, signatureY + 5, { align: 'center' });

    doc.save(`${ticketId}.pdf`);
}

export function TicketDetails({ ticket }: TicketDetailsProps) {
    const { toast } = useToast();
    const ticketId = ticket.ticketNumber ? `ORD-${String(ticket.ticketNumber).padStart(3, '0')}` : ticket.id.substring(0, 7) + '...';


    const updateStatus = async (newStatus: Ticket['status']) => {
        const ticketRef = doc(db, "tickets", ticket.id);
        const payload = { status: newStatus };
        try {
            await updateDoc(ticketRef, payload);
            toast({
                title: "Estado Actualizado",
                description: `El ticket ha sido marcado como ${newStatus}.`,
            });
        } catch (error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: ticketRef.path,
                operation: 'update',
                requestResourceData: payload,
            }));
        }
    };
    
    const updateUrgency = async (newUrgency: Ticket['urgency']) => {
        const ticketRef = doc(db, "tickets", ticket.id);
        const payload = { urgency: newUrgency };
        try {
            await updateDoc(ticketRef, payload);
            toast({
                title: "Urgencia Actualizada",
                description: `La urgencia del ticket se ha cambiado a ${newUrgency}.`,
            });
        } catch (error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: ticketRef.path,
                operation: 'update',
                requestResourceData: payload,
            }));
        }
    };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                 <CardTitle className="text-2xl font-headline">Detalles del Ticket #{ticketId}</CardTitle>
                 <CardDescription>Creado el {ticket.createdAt.toDate().toLocaleString('es-MX')}</CardDescription>
            </div>
             <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Estado:</span>
                <Badge variant={ticket.status === 'Resuelto' ? 'secondary' : 'default'} className={cn(
                    'text-white',
                    ticket.status === 'Recibido' && 'bg-blue-500',
                    ticket.status === 'En Progreso' && 'bg-yellow-500 text-black',
                    ticket.status === 'Resuelto' && 'bg-green-500'
                )}>{ticket.status}</Badge>
            </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
            <h3 className="text-lg font-semibold mb-2 font-headline">Información del Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div><span className="font-medium text-muted-foreground">Nombre:</span> {ticket.clientName}</div>
                <div><span className="font-medium text-muted-foreground">Teléfono:</span> {ticket.clientPhone}</div>
                <div className="col-span-full"><span className="font-medium text-muted-foreground">Dirección:</span> {ticket.clientAddress}</div>
            </div>
        </section>

        <Separator />

        <section>
            <h3 className="text-lg font-semibold mb-2 font-headline">Detalles del Servicio</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                <div><span className="font-medium text-muted-foreground">Tipo de Servicio:</span> {ticket.serviceType === 'correctivo' ? 'Correctivo' : 'Preventivo'}</div>
                <div><span className="font-medium text-muted-foreground">Equipo/Asunto:</span> {ticket.equipmentType}</div>
                <div className="flex items-center gap-2">
                    <span className="font-medium text-muted-foreground">Urgencia:</span>
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                             <Button variant="outline" size="sm" className="h-auto py-0.5 px-2">
                                <Badge variant="outline" className={cn('border-none p-0',
                                    ticket.urgency === 'alta' && 'text-red-500',
                                    ticket.urgency === 'media' && 'text-yellow-500',
                                    ticket.urgency === 'baja' && 'text-green-500'
                                )}>{ticket.urgency.charAt(0).toUpperCase() + ticket.urgency.slice(1)}</Badge>
                                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
                             </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => updateUrgency('baja')}>Baja</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateUrgency('media')}>Media</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateUrgency('alta')}>Alta</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                 <div><span className="font-medium text-muted-foreground">Precio:</span> {ticket.price ? `$${ticket.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/A'}</div>
                 {ticket.quantity && <div><span className="font-medium text-muted-foreground">Cantidad:</span> {ticket.quantity}</div>}
            </div>
             <div className="mt-4">
                <p className="font-medium text-muted-foreground text-sm">Descripción del Problema:</p>
                <p className="text-sm mt-1 p-3 bg-muted/50 rounded-md">{ticket.description}</p>
            </div>
        </section>
      </CardContent>
      <CardFooter className="flex-col sm:flex-row justify-end gap-2 bg-muted/30 py-4 px-6">
        <Button variant="outline" onClick={async () => await downloadServiceOrderPDF(ticket)}><Download className="mr-2"/>Descargar Orden</Button>
        <Button disabled={ticket.status === 'En Progreso'} onClick={() => updateStatus("En Progreso")}>Marcar como En Progreso</Button>
        <Button disabled={ticket.status === 'Resuelto'} onClick={() => updateStatus("Resuelto")} className="bg-green-600 hover:bg-green-700">Marcar como Resuelto</Button>
      </CardFooter>
    </Card>
  );
}
