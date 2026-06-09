
"use client";

import { useState } from "react";
import { TicketTable } from "@/components/admin/ticket-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlusCircle, Ticket } from "lucide-react";
import { TicketForm } from "@/components/forms/ticket-form";

export default function TicketsPage() {
    const [isFormOpen, setIsFormOpen] = useState(false);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <div>
                        <div className="flex items-center gap-3">
                            <Ticket className="w-6 h-6" />
                            <CardTitle>Gestión de Tickets</CardTitle>
                        </div>
                        <CardDescription>Ver, gestionar y asignar todos los tickets de soporte desde este panel central.</CardDescription>
                    </div>
                    <Button onClick={() => setIsFormOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Crear Ticket Manualmente
                    </Button>
                </CardHeader>
                <CardContent>
                    <TicketTable />
                </CardContent>
            </Card>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-3xl">
                     <DialogHeader>
                        <DialogTitle>Crear Nuevo Ticket Manualmente</DialogTitle>
                        <DialogDescription>
                            Complete el formulario para crear una nueva orden de servicio.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[80vh] overflow-y-auto px-2">
                        <TicketForm onTicketCreated={() => setIsFormOpen(false)} isAdminMode={true} />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
