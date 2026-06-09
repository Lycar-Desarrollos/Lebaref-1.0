

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Loader2, MessageSquare, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { addDoc, collection, serverTimestamp, runTransaction, doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Input } from "../ui/input";
import { Client } from "../admin/client-manager";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "../ui/command";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

const ticketSchema = z.object({
  serviceType: z.enum(["correctivo", "preventivo", "instalacion"], {
    required_error: "Por favor seleccione el tipo de servicio.",
  }),
  equipmentType: z.string().min(3, {
    message: "Por favor, describa el asunto o equipo (ej. Falla en Horno).",
  }),
  description: z.string().min(20, {
    message: "La descripción debe tener al menos 20 caracteres.",
  }).max(500, {
    message: "La descripción no puede exceder los 500 caracteres."
  }),
  urgency: z.enum(["baja", "media", "alta"], {
    required_error: "Por favor seleccione un nivel de urgencia.",
  }),
  price: z.coerce.number().optional(),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1.").optional(),
  clientName: z.string().min(1, { message: "El nombre es obligatorio." }),
  clientPhone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos." }),
  clientAddress: z.string().min(1, { message: "La dirección es obligatoria." }),
  clientEmail: z.string().email({ message: "Por favor ingrese un correo válido." }).optional().or(z.literal('')),
  clientRfc: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

interface TicketFormProps {
    onTicketCreated?: () => void;
    isAdminMode?: boolean;
}

export function TicketForm({ onTicketCreated, isAdminMode = false }: TicketFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [isClientComboboxOpen, setIsClientComboboxOpen] = useState(false);
  const [hasPreselectedService, setHasPreselectedService] = useState(false);
  

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      description: "",
      equipmentType: "",
      serviceType: undefined,
      urgency: "media",
      price: undefined,
      quantity: 1,
      clientName: "",
      clientPhone: "",
      clientAddress: "",
      clientEmail: "",
      clientRfc: "",
    },
  });

  const unitPrice = form.watch('price');
  const quantity = form.watch('quantity');
  const estimatedTotal = (unitPrice || 0) * (quantity || 1);

  useEffect(() => {
    const serviceType = searchParams.get('serviceType');
    const equipmentType = searchParams.get('equipmentType');
    const price = searchParams.get('price');

    if (serviceType === 'correctivo' || serviceType === 'preventivo' || serviceType === 'instalacion') {
        form.setValue('serviceType', serviceType);
        setHasPreselectedService(true);
    }
    if (equipmentType) {
        form.setValue('equipmentType', equipmentType);
    }
    if (price) {
        form.setValue('price', parseFloat(price));
    }
    if (user?.email && !isAdminMode) {
        form.setValue('clientEmail', user.email);
    }
  }, [searchParams, form, user, isAdminMode]);

  useEffect(() => {
    let unsubscribeClients = () => {};
    if (user || isAdminMode) {
        const qClients = collection(db, "clients");
        unsubscribeClients = onSnapshot(qClients, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
            setClients(clientsData);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'clients', operation: 'list' }));
        });
    }

    return () => {
        unsubscribeClients();
    };
  }, [user, isAdminMode]);

  async function createTicketInApp(data: TicketFormValues) {
    if (!user && !isAdminMode) {
        router.push('/signup');
        return;
    }
    setIsSubmitting(true);
    const finalPrice = data.price ? data.price * (data.quantity || 1) : undefined;
    const ticketPayload = {
      ...data,
      price: finalPrice,
      userId: isAdminMode ? 'admin_created' : user!.uid,
      status: "Recibido",
      createdAt: serverTimestamp(),
    };
    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "tickets");
        const counterDoc = await transaction.get(counterRef);
        let newTicketNumber = 1;
        if (counterDoc.exists()) {
          newTicketNumber = counterDoc.data().lastNumber + 1;
        }
        transaction.set(counterRef, { lastNumber: newTicketNumber }, { merge: true });
        
        const newTicketRef = doc(collection(db, "tickets"));
        transaction.set(newTicketRef, { ...ticketPayload, ticketNumber: newTicketNumber });
      });

      toast({
        title: "¡Ticket Enviado!",
        description: "Se ha creado una nueva orden de servicio.",
      });

      form.reset();
      if(onTicketCreated) {
          onTicketCreated();
      } else {
         router.push('/profile/my-tickets');
      }

    } catch (error) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: 'tickets',
        operation: 'create',
        requestResourceData: ticketPayload
      }));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleWhatsAppRedirect(data: TicketFormValues) {
    const message = `
*Nueva Solicitud de Servicio*

*Cliente:* ${data.clientName}
*Teléfono:* ${data.clientPhone}
*Dirección:* ${data.clientAddress}
*Tipo de Servicio:* ${data.serviceType}
*Equipo/Asunto:* ${data.equipmentType}
*Descripción:* ${data.description}
*Urgencia:* ${data.urgency}
${data.quantity ? `*Cantidad:* ${data.quantity}` : ''}
${estimatedTotal > 0 ? `*Total Estimado:* $${estimatedTotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN` : ''}
    `.trim().replace(/\n\s*\n/g, '\n');

    const whatsappUrl = `https://wa.me/529993101452?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  }

  const handleWhatsAppClick = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      handleWhatsAppRedirect(form.getValues());
    } else {
      toast({
        title: "Formulario Incompleto",
        description: "Por favor, llene todos los campos requeridos antes de enviar por WhatsApp.",
        variant: "destructive"
      });
    }
  };

  function onSubmit(data: TicketFormValues) {
    if (user || isAdminMode) {
      createTicketInApp(data);
    } else {
      router.push('/signup');
    }
  }
  
  if (isLoading && !isAdminMode) {
    return <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="space-y-4 border-b pb-6">
             <h3 className="text-lg font-medium">Información del Cliente</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField
                    name="clientName"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Nombre Completo</FormLabel>
                            <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                        >
                                            {field.value || "Seleccionar o escribir cliente"}
                                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                    <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                                        <CommandInput
                                            placeholder="Buscar cliente..."
                                            onValueChange={(search) => field.onChange(search)}
                                        />
                                        <CommandList>
                                            <CommandEmpty>No se encontró cliente.</CommandEmpty>
                                            <CommandGroup>
                                                {clients.map((client) => (
                                                    <CommandItem
                                                        value={client.name}
                                                        key={client.id}
                                                        onSelect={() => {
                                                            form.setValue("clientName", client.name);
                                                            form.setValue("clientPhone", client.phone);
                                                            form.setValue("clientAddress", client.address || "");
                                                            form.setValue("clientEmail", client.email || "");
                                                            form.setValue("clientRfc", client.rfc || "");
                                                            field.onChange(client.name);
                                                            setIsClientComboboxOpen(false);
                                                        }}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", client.name === field.value ? "opacity-100" : "opacity-0")} />
                                                        {client.name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField control={form.control} name="clientPhone" render={({ field }) => (
                    <FormItem><FormLabel>Número de Teléfono</FormLabel><FormControl><Input placeholder="Ej: 9991234567" {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
             </div>
             <FormField control={form.control} name="clientAddress" render={({ field }) => (
                <FormItem><FormLabel>Dirección Completa</FormLabel><FormControl><Input placeholder="Calle, Número, Colonia, Ciudad" {...field} /></FormControl><FormMessage /></FormItem>
             )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={form.control} name="clientEmail" render={({ field }) => (
                    <FormItem><FormLabel>Correo Electrónico (Opcional)</FormLabel><FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
                 <FormField control={form.control} name="clientRfc" render={({ field }) => (
                    <FormItem><FormLabel>RFC (Opcional)</FormLabel><FormControl><Input placeholder="Ej: PEJU800101XXX" {...field} /></FormControl><FormMessage /></FormItem>
                 )} />
             </div>
        </div>

        <div className="space-y-4">
             <h3 className="text-lg font-medium">Detalles del Servicio</h3>
            <FormField
            control={form.control}
            name="serviceType"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Tipo de Servicio</FormLabel>
                <Select onValueChange={field.onChange} value={field.value} disabled={hasPreselectedService}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleccione el tipo de servicio requerido" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="instalacion">Instalación</SelectItem>
                    <SelectItem value="correctivo">Mantenimiento Correctivo</SelectItem>
                    <SelectItem value="preventivo">Mantenimiento Preventivo</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="equipmentType"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Asunto / Equipo</FormLabel>
                <FormControl>
                    <Input
                    placeholder="Ej: Falla en estufa, Contratar plan de hornos..."
                    {...field}
                    />
                </FormControl>
                {!isAdminMode && <FormDescription>
                    Sea lo más específico posible. Si viene de la página de servicios, esto se llena automáticamente.
                </FormDescription>}
                <FormMessage />
                </FormItem>
            )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Precio (Opcional)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.valueAsNumber)} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Cantidad (Opcional)</FormLabel>
                        <FormControl><Input type="number" min={1} {...field} value={field.value ?? ''} onChange={e => field.onChange(e.target.valueAsNumber)}/></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
            </div>

            <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Descripción de la Falla o Necesidad</FormLabel>
                <FormControl>
                    <Textarea
                    placeholder="Por favor describa el problema o la necesidad en detalle..."
                    className="min-h-[150px]"
                    {...field}
                    />
                </FormControl>
                 {!isAdminMode && <FormDescription>
                    Mientras más detalles nos brinde, más rápido podremos ayudarle.
                </FormDescription>}
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="urgency"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Nivel de Urgencia</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                    <SelectTrigger>
                        <SelectValue placeholder="¿Qué tan urgente es este problema?" />
                    </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    <SelectItem value="baja">Baja - Puede esperar</SelectItem>
                    <SelectItem value="media">Media - Afecta la operación</SelectItem>
                    <SelectItem value="alta">Alta - Operación detenida</SelectItem>
                    </SelectContent>
                </Select>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>

        {isAdminMode ? (
             <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Creando..." : "Crear Ticket"}
            </Button>
        ) : user ? (
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting ? "Enviando..." : "Enviar Ticket"}
            </Button>
        ) : (
            <div className="flex flex-col sm:flex-row gap-4">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UserPlus className="mr-2" />
                    Crear Ticket en la App
                </Button>
                <Button type="button" variant="outline" onClick={handleWhatsAppClick} className="w-full">
                    <MessageSquare className="mr-2" />
                    Enviar por WhatsApp
                </Button>
            </div>
        )}
        
      </form>
    </Form>
  );
}
