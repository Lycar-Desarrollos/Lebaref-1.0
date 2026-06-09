

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEffect, useState } from "react";
import { Loader2, PlusCircle, Trash2, Check, ChevronsUpDown, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import type { Quote } from "@/components/admin/quote-manager";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "@/components/admin/service-manager";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SparePart } from "../admin/spare-parts-manager";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Client } from "../admin/client-manager";


const quoteItemSchema = z.object({
  description: z.string().min(1, "La descripción es requerida."),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
  unidad: z.string().optional(),
});

const quoteFormSchema = z.object({
  clientName: z.string().min(2, "El nombre del cliente es requerido."),
  clientPhone: z.string().optional().or(z.literal('')),
  clientEmail: z.string().email({ message: "Correo inválido." }).optional().or(z.literal('')),
  clientAddress: z.string().min(1, "La dirección es requerida."),
  serviceAddress: z.string().optional().or(z.literal('')),
  responsable: z.string().optional().or(z.literal('')),
  hideClientPhone: z.boolean().default(false),
  date: z.string().min(1, "La fecha es requerida."),
  status: z.enum(["Borrador", "Enviada", "Aceptada", "Rechazada", "Pagada"]),
  tipoServicio: z.string().optional(),
  tipoTrabajo: z.string().optional(),
  equipoLugar: z.string().optional(),
  items: z.array(quoteItemSchema).min(1, "Debe agregar al menos un ítem."),
  expirationDate: z.string().optional(),
  rfc: z.string().optional(),
  observations: z.string().optional(),
  policies: z.string().optional(),
  paymentTerms: z.string().optional(),
  iva: z.coerce.number().min(0, "El IVA no puede ser negativo.").default(16),
});

type QuoteFormValues = z.infer<typeof quoteFormSchema>;

interface QuoteFormProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onSave?: (quote: Omit<Quote, 'id' | 'quoteNumber' | 'userId' | 'subtotal' | 'total' | 'history'> & { subtotal: number, total: number }) => void;
  quote?: Partial<Quote> | null;
  userRole?: 'admin' | 'employee';
}

const formatDate = (date: Date) => {
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - userTimezoneOffset);
    return localDate.toISOString().split('T')[0];
};

const today = new Date();
const expiration = new Date();
expiration.setDate(today.getDate() + 15);

const defaultPolicies = `1- EQUIPO NUEVO: La garantía para equipos de refrigeración suministrados por nosotros cubre defectos de fabricación por un período de 1 año a partir de la fecha de instalación. Para componentes específicos como compresores, la garantía puede extenderse hasta 5 años para uso residencial y 3 años para uso comercial o público. Es obligatorio realizar un mínimo de 2 mantenimientos preventivos anuales para mantener la validez de esta garantía. Aplican restricciones según los términos y condiciones del fabricante. Para otros equipos suministrados por nosotros, la garantía será la que brinde el fabricante, y los alcances de la misma estarán sujetos a lo determinado por dicho fabricante.
2- INSTALACIÓN DE EQUIPOS: Ofrecemos una garantía de 90 días por la mano de obra en la instalación de equipos, siempre que haya sido realizada por nuestros técnicos especializados. Esta garantía cubre cualquier defecto o falla derivada directamente de la instalación. Sin embargo, no se cubren daños resultantes del uso indebido, modificaciones no autorizadas, o condiciones ambientales adversas no reportadas previamente.
3- MANTENIMIENTO PREVENTIVO Y/O CORRECTIVO: Nuestros servicios de mantenimiento preventivo y/o correctivo están respaldados por una garantía de 60 días sobre la mano de obra efectuada. Esta garantía se limita a los trabajos específicos realizados y no cubre componentes que no hayan sido objeto de mantenimiento o revisión. Adicionalmente, no se garantiza contra fallos originados por un uso inadecuado, negligencia o falta de mantenimiento regular.
4- REFACCIONES Y PIEZAS DE REEMPLAZO: La garantía sobre refacciones y piezas de reemplazo será la que determine el fabricante correspondiente. Las piezas electrónicas, como tarjetas de control y circuitos, no cuentan con garantía, a menos que se especifique explícitamente. Es responsabilidad del cliente asegurarse de que el equipo esté correctamente instalado y mantenido para evitar daños que invaliden la garantía.
5- SISTEMAS ELÉCTRICOS Y ELECTRÓNICOS: Ofrecemos 60 días de garantía limitada sobre instalaciones eléctricas y electrónicas, bajo la condición de que el sistema cuente con una correcta tierra física y cumpla con todas las normativas de seguridad aplicables. Cualquier alteración o instalación incorrecta que no haya sido realizada por nuestros especialistas anulará esta garantía.
6- INSTALACIONES GENERALES Y SISTEMAS DEFECTUOSOS: Proporcionamos una garantía de 60 días para cualquier trabajo de instalación o reparación realizado por nuestro equipo, siempre y cuando los defectos sean atribuibles a una ejecución incorrecta. Esta garantía no cubre daños posteriores ocasionados por factores externos, negligencia del usuario o intervenciones de terceros.
7- CONDICIONES GENERALES: Las garantías mencionadas no aplican en situaciones de mal uso, desgaste natural, accidentes, daños por condiciones ambientales extremas, o intervenciones no autorizadas. Todas las garantías están sujetas a los términos y condiciones establecidos en el contrato de servicio, así como a la normativa vigente en la materia. Es responsabilidad del cliente seguir las recomendaciones de mantenimiento proporcionadas por nosotros para garantizar la durabilidad y correcto funcionamiento de los equipos e instalaciones.`;

const defaultPaymentTerms = `Formas de Pago: Transferencia Bancaria / Depósitos
Banco: Banco Mercantil del Norte, BANORTE
Cuenta: 1053332481
Clabe Interbancaria: 072 910 01053332481 1
Beneficiario: LEBAREF SERVICIO DE MANTENIMIENTO GENERAL
RFC: LSM150727IP0`;

const defaultValues: QuoteFormValues = {
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  clientAddress: "",
  serviceAddress: "",
  responsable: "",
  hideClientPhone: false,
  date: formatDate(new Date()),
  status: "Borrador",
  tipoServicio: "Correctivo",
  tipoTrabajo: "",
  equipoLugar: "",
  items: [],
  expirationDate: formatDate(expiration),
  rfc: "",
  observations: "",
  policies: defaultPolicies,
  paymentTerms: defaultPaymentTerms,
  iva: 16,
};

export function QuoteForm({ 
  isOpen = true, 
  onOpenChange = () => {}, 
  onSave = async () => {}, 
  quote = null, 
  userRole 
}: QuoteFormProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isClientComboboxOpen, setIsClientComboboxOpen] = useState(false);
  const isAdmin = userRole === 'admin';
  const { toast } = useToast();


  useEffect(() => {
      const qServices = collection(db, "services");
      const unsubscribeServices = onSnapshot(qServices, (snapshot) => {
          setServices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service)));
      }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'services',
                operation: 'list',
            }));
      });

      const qParts = collection(db, "spare_parts");
      const unsubscribeParts = onSnapshot(qParts, (snapshot) => {
        setSpareParts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SparePart)));
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'spare_parts',
            operation: 'list',
        }));
    });
      
    let unsubscribeClients = () => {};
    if (userRole) {
      const qClients = collection(db, "clients");
      unsubscribeClients = onSnapshot(qClients, (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(clientsData);
      }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'clients',
            operation: 'list',
        }));
      });
    }

      return () => {
        unsubscribeServices();
        unsubscribeParts();
        unsubscribeClients();
      }
  }, [userRole]);

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: defaultValues,
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  useEffect(() => {
    if (isOpen) {
      if (quote) {
        // When editing, explicitly set form values from the quote prop to avoid issues.
        form.reset({
          clientName: quote.clientName || "",
          clientPhone: quote.clientPhone || "",
          clientEmail: quote.clientEmail || "",
          clientAddress: quote.clientAddress || "",
          serviceAddress: quote.serviceAddress || "",
          responsable: quote.responsable || "",
          hideClientPhone: quote.hideClientPhone || false,
          date: quote.date ? new Date(quote.date).toISOString().split('T')[0] : formatDate(new Date()),
          status: quote.status || "Borrador",
          tipoServicio: quote.tipoServicio || "Correctivo",
          tipoTrabajo: quote.tipoTrabajo || "",
          equipoLugar: quote.equipoLugar || "",
          items: quote.items || [],
          expirationDate: quote.expirationDate ? new Date(quote.expirationDate).toISOString().split('T')[0] : formatDate(expiration),
          rfc: quote.rfc || "",
          observations: quote.observations || "",
          policies: quote.policies || defaultPolicies,
          paymentTerms: quote.paymentTerms || defaultPaymentTerms,
          iva: quote.iva ?? 16,
        });
      } else {
        // When creating a new quote, use the default values.
        form.reset(defaultValues);
      }
    }
  }, [quote, isOpen, form]);

  const items = form.watch('items');
  const ivaPercentage = form.watch('iva');
  
  const subtotal = (items || []).reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
  const ivaAmount = subtotal * (ivaPercentage / 100);
  const total = subtotal + ivaAmount;

  const onSubmit = async (data: QuoteFormValues) => {
    setIsSubmitting(true);
    await onSave({ ...data, subtotal, total });
    setIsSubmitting(false);
    onOpenChange(false);
  };
  
  const handleItemSelect = (itemId: string, type: 'service' | 'part') => {
    if (type === 'service') {
        const service = services.find(s => s.id === itemId);
        if (service) {
          append({ description: service.title, quantity: 1, price: service.price, unidad: 'Servicio' });
        }
    } else {
        const part = spareParts.find(p => p.id === itemId);
        if (part) {
            append({ description: part.name, quantity: 1, price: part.price, unidad: 'PZA' });
        }
    }
    setIsComboboxOpen(false);
  };

  const quoteIdDisplay = quote?.quoteNumber ? `C01-${String(quote.quoteNumber).padStart(4, '0')}` : "Nueva Cotización";


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-[1200px] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{quote?.id ? `Editar Cotización #${quoteIdDisplay}` : "Crear Nueva Cotización"}</DialogTitle>
          <DialogDescription>Complete los detalles para generar el documento de cotización.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <div className="space-y-6 px-6 overflow-y-auto max-h-[calc(80vh-150px)]">
            
              {/* Client and Date Info */}
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 <FormField
                    name="clientName"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Cliente</FormLabel>
                        <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                    "w-full justify-between font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                <span className="truncate">{field.value || "Seleccionar o escribir un cliente"}</span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command filter={(value, search) => {
                                const clientName = value.split('||')[0];
                                if (clientName.toLowerCase().includes(search.toLowerCase())) return 1;
                                return 0;
                            }}>
                                <CommandInput
                                placeholder="Buscar cliente por nombre o RFC..."
                                onValueChange={(search) => {
                                    field.onChange(search);
                                }}
                                />
                                <CommandList>
                                <CommandEmpty>No se encontró cliente. Puede crear uno nuevo al terminar de escribir.</CommandEmpty>
                                <CommandGroup>
                                    {clients.map((client) => (
                                    <CommandItem
                                        value={`${client.name}||${client.rfc}`}
                                        key={client.id}
                                        onSelect={() => {
                                            form.setValue("clientName", client.name);
                                            form.setValue("clientPhone", client.phone);
                                            form.setValue("clientAddress", client.address || "");
                                            form.setValue("clientEmail", client.email || "");
                                            form.setValue("rfc", client.rfc || "");
                                            field.onChange(client.name);
                                            setIsClientComboboxOpen(false);
                                        }}
                                    >
                                        <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            client.name === field.value ? "opacity-100" : "opacity-0"
                                        )}
                                        />
                                        <div>
                                            <p>{client.name}</p>
                                            <p className="text-xs text-muted-foreground">{client.rfc}</p>
                                        </div>
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
                      <div className="flex flex-col gap-2">
                    <FormField name="clientPhone" control={form.control} render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono del Cliente (Opcional)</FormLabel>
                          <FormControl><Input {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                    )} />
                    <FormField name="hideClientPhone" control={form.control} render={({ field }) => (
                        <FormItem className="flex items-center space-x-2 space-y-0 mt-2">
                          <FormControl>
                            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="text-xs cursor-pointer">Ocultar teléfono en PDF</FormLabel>
                        </FormItem>
                    )} />
                  </div>
                  <FormField name="responsable" control={form.control} render={({ field }) => (
                     <FormItem>
                       <FormLabel>Responsable (Contacto/Atención)</FormLabel>
                       <FormControl><Input placeholder="Nombre del responsable" {...field} /></FormControl>
                       <FormMessage />
                     </FormItem>
                  )} />
                   <FormField name="clientEmail" control={form.control} render={({ field }) => (
                     <FormItem><FormLabel>Email (Opcional)</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="rfc" control={form.control} render={({ field }) => (
                     <FormItem><FormLabel>RFC (Opcional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField name="status" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Estado</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Borrador">Borrador</SelectItem>
                          <SelectItem value="Enviada">Enviada</SelectItem>
                          <SelectItem value="Aceptada">Aceptada</SelectItem>
                          <SelectItem value="Pagada">Pagada</SelectItem>
                          <SelectItem value="Rechazada">Rechazada</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                   <FormField name="clientAddress" control={form.control} render={({ field }) => (
                      <FormItem className="lg:col-span-3"><FormLabel>Dirección Fiscal del Cliente</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField name="serviceAddress" control={form.control} render={({ field }) => (
                      <FormItem className="lg:col-span-3"><FormLabel>Dirección del Servicio (Lugar de ejecución)</FormLabel><FormControl><Input placeholder="Dejar vacío si es la misma que la fiscal" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="date" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Fecha de Emisión</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="expirationDate" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Fecha de Vencimiento</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
              
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Detalles del Servicio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField name="tipoServicio" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Tipo de Servicio</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField name="tipoTrabajo" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Tipo de Trabajo</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField name="equipoLugar" control={form.control} render={({ field }) => (
                        <FormItem><FormLabel>Equipo/Lugar</FormLabel><FormControl><Input {...field} value={field.value || ''} /></FormControl><FormMessage /></FormItem>
                    )} />
                </div>
              </div>

              {/* Items Section */}
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Items de la Cotización</h3>
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-2">
                            <FormField name={`items.${index}.description`} control={form.control} render={({ field }) => (
                                <FormItem className="flex-grow"><FormLabel className="text-xs">Descripción</FormLabel><FormControl><Textarea placeholder="Descripción del item" className="min-h-[38px] h-9 resize-y py-1.5" {...field} /></FormControl></FormItem>
                            )} />
                            <FormField name={`items.${index}.unidad`} control={form.control} render={({ field }) => (
                                <FormItem className="w-20"><FormLabel className="text-xs">Unidad</FormLabel><FormControl><Input placeholder="PZA" {...field} /></FormControl></FormItem>
                            )} />
                             <FormField name={`items.${index}.quantity`} control={form.control} render={({ field }) => (
                                <FormItem className="w-24"><FormLabel className="text-xs">Cant.</FormLabel><FormControl><Input type="number" placeholder="Cant." {...field} /></FormControl></FormItem>
                            )} />
                             <FormField name={`items.${index}.price`} control={form.control} render={({ field }) => (
                                <FormItem className="w-32"><FormLabel className="text-xs">Precio Unit.</FormLabel><FormControl><Input type="number" step="0.01" placeholder="Precio" {...field} /></FormControl></FormItem>
                            )} />
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
                 <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                    <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-[300px] justify-between">
                                Agregar item existente...
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                                <CommandInput placeholder="Buscar por nombre o SKU..." />
                                <CommandList>
                                    <CommandEmpty>No se encontraron items.</CommandEmpty>
                                    <CommandGroup heading="Servicios">
                                        {services.map((service) => (
                                            <CommandItem
                                                key={service.id}
                                                value={`${service.title} ${service.sku}`}
                                                onSelect={() => handleItemSelect(service.id!, 'service')}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                                {service.title}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    <CommandGroup heading="Refacciones">
                                        {spareParts.map((part) => (
                                            <CommandItem
                                                key={part.id}
                                                value={`${part.name} ${part.brand} ${part.sku}`}
                                                onSelect={() => handleItemSelect(part.id!, 'part')}
                                            >
                                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                                                {part.name} ({part.brand})
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                     <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, price: 0, unidad: 'PZA' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Item Manual
                    </Button>
                </div>
                {form.formState.errors.items && <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.items?.root?.message || form.formState.errors.items.message}</p>}
              </div>
            
              {/* Notes and Totals */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FormField name="observations" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Comentarios y Diagnóstico</FormLabel>
                        <FormControl><Textarea placeholder="Añadir notas u observaciones específicas para esta cotización..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="policies" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Garantías</FormLabel>
                        <FormControl><Textarea placeholder="Describa las garantías del servicio o producto..." className="min-h-[100px]" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                  <FormField name="paymentTerms" control={form.control} render={({ field }) => (
                    <FormItem>
                        <FormLabel>Condiciones de Pago</FormLabel>
                        <FormControl><Textarea className="min-h-[130px] resize-none" {...field} disabled={!isAdmin} /></FormControl>
                        <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <div className="flex flex-col justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center font-medium">
                            <span>Subtotal:</span>
                            <span>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <FormField name="iva" control={form.control} render={({ field }) => (
                                <FormItem className="flex items-center gap-2">
                                    <FormLabel className="m-0 p-0">IVA (%):</FormLabel>
                                    <FormControl><Input type="number" className="w-20 h-8" {...field} /></FormControl>
                                </FormItem>
                            )} />
                            <span>${ivaAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                    <div>
                        <Separator className="my-3 bg-border" />
                        <div className="flex justify-between text-xl font-bold">
                            <span>Total:</span>
                            <span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
              </div>
              {/* Historial de Cambios */}
              {quote?.history && quote.history.length > 0 && (
                <div className="border p-4 rounded-lg bg-muted/30 mt-6">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                    <History className="h-4 w-4 text-muted-foreground" /> Historial de Modificaciones
                  </h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {quote.history.map((entry, index) => (
                      <div key={index} className="flex justify-between items-center text-xs border-b pb-2 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-foreground">
                            Modificado por <span className="font-semibold">{entry.userName}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(entry.updatedAt).toLocaleString('es-MX')}
                          </p>
                        </div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-[10px] py-1"
                          onClick={() => {
                            form.reset({
                              clientName: entry.snapshot.clientName || "",
                              clientPhone: entry.snapshot.clientPhone || "",
                              clientEmail: entry.snapshot.clientEmail || "",
                              clientAddress: entry.snapshot.clientAddress || "",
                              serviceAddress: entry.snapshot.serviceAddress || "",
                              responsable: entry.snapshot.responsable || "",
                              hideClientPhone: entry.snapshot.hideClientPhone || false,
                              date: entry.snapshot.date || formatDate(new Date()),
                              status: entry.snapshot.status || "Borrador",
                              tipoServicio: entry.snapshot.tipoServicio || "Correctivo",
                              tipoTrabajo: entry.snapshot.tipoTrabajo || "",
                              equipoLugar: entry.snapshot.equipoLugar || "",
                              items: entry.snapshot.items || [],
                              expirationDate: entry.snapshot.expirationDate || formatDate(expiration),
                              rfc: entry.snapshot.rfc || "",
                              observations: entry.snapshot.observations || "",
                              policies: entry.snapshot.policies || defaultPolicies,
                              paymentTerms: entry.snapshot.paymentTerms || defaultPaymentTerms,
                              iva: entry.snapshot.iva ?? 16,
                            });
                            toast({
                              title: "Versión Restaurada",
                              description: "Se han cargado los valores de esta versión en el formulario. Guarda la cotización para confirmar la restauración.",
                            });
                          }}
                        >
                          Restaurar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t mt-6">
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cotización
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

