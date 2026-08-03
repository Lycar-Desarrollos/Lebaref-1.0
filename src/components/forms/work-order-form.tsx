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
import { Loader2, PlusCircle, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { Service } from "@/components/admin/service-manager";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SparePart } from "../admin/spare-parts-manager";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Client } from "../admin/client-manager";
import type { WorkOrder } from "@/components/admin/work-order-manager";

// ─── Zod Schema (sin campos financieros) ─────────────────────────────────────
const workOrderItemSchema = z.object({
  description: z.string().min(1, "La descripción es requerida."),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  unidad: z.string().optional(),
});

const workOrderFormSchema = z.object({
  clientName: z.string().min(2, "El nombre del cliente es requerido."),
  clientPhone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos."),
  clientAddress: z.string().min(1, "La dirección es requerida."),
  serviceAddress: z.string().optional().or(z.literal("")),
  responsable: z.string().optional().or(z.literal("")),
  date: z.string().min(1, "La fecha es requerida."),
  status: z.enum(["Pendiente", "En Proceso", "Completado", "Cancelado"]),
  technician: z.string().optional().or(z.literal("")),
  tipoServicio: z.string().optional(),
  tipoTrabajo: z.string().optional(),
  equipoLugar: z.string().optional(),
  items: z.array(workOrderItemSchema).min(1, "Debe agregar al menos un ítem."),
  observations: z.string().optional(),
});

type WorkOrderFormValues = z.infer<typeof workOrderFormSchema>;

interface WorkOrderFormProps {
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  onSave?: (data: Omit<WorkOrder, "id" | "otNumber" | "userId" | "createdAt">) => void;
  workOrder?: Partial<WorkOrder> | null;
  userRole?: "admin" | "employee";
}

const formatDate = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().split("T")[0];
};

const defaultValues: WorkOrderFormValues = {
  clientName: "",
  clientPhone: "",
  clientAddress: "",
  serviceAddress: "",
  responsable: "",
  date: formatDate(new Date()),
  status: "Pendiente",
  technician: "",
  tipoServicio: "Correctivo",
  tipoTrabajo: "",
  equipoLugar: "",
  items: [],
  observations: "",
};

export function WorkOrderForm({
  isOpen = true,
  onOpenChange = () => {},
  onSave = async () => {},
  workOrder = null,
  userRole,
}: WorkOrderFormProps) {
  const [services, setServices] = useState<Service[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);
  const [isClientComboboxOpen, setIsClientComboboxOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubServices = onSnapshot(collection(db, "services"), (snap) => {
      setServices(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Service)));
    }, () => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "services", operation: "list" }));
    });

    const unsubParts = onSnapshot(collection(db, "spare_parts"), (snap) => {
      setSpareParts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as SparePart)));
    }, () => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "spare_parts", operation: "list" }));
    });

    let unsubClients = () => {};
    if (userRole) {
      unsubClients = onSnapshot(collection(db, "clients"), (snap) => {
        setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)));
      }, () => {
        errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "clients", operation: "list" }));
      });
    }

    return () => { unsubServices(); unsubParts(); unsubClients(); };
  }, [userRole]);

  const form = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (isOpen) {
      if (workOrder) {
        form.reset({
          clientName: workOrder.clientName || "",
          clientPhone: workOrder.clientPhone || "",
          clientAddress: workOrder.clientAddress || "",
          serviceAddress: workOrder.serviceAddress || "",
          responsable: workOrder.responsable || "",
          date: workOrder.date || formatDate(new Date()),
          status: workOrder.status || "Pendiente",
          technician: workOrder.technician || "",
          tipoServicio: workOrder.tipoServicio || "Correctivo",
          tipoTrabajo: workOrder.tipoTrabajo || "",
          equipoLugar: workOrder.equipoLugar || "",
          items: (workOrder.items || []).map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unidad: i.unidad || "PZA",
          })),
          observations: workOrder.observations || "",
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [workOrder, isOpen, form]);

  const handleItemSelect = (itemId: string, type: "service" | "part") => {
    if (type === "service") {
      const service = services.find((s) => s.id === itemId);
      if (service) append({ description: service.title, quantity: 1, unidad: "Servicio" });
    } else {
      const part = spareParts.find((p) => p.id === itemId);
      if (part) append({ description: part.name, quantity: 1, unidad: "PZA" });
    }
    setIsComboboxOpen(false);
  };

  const onSubmit = async (data: WorkOrderFormValues) => {
    setIsSubmitting(true);
    await onSave(data as any);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  const otLabel = workOrder?.otNumber ? workOrder.otNumber : "Nueva Orden de Trabajo";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{workOrder?.id ? `Editar Orden de Trabajo — ${otLabel}` : "Crear Nueva Orden de Trabajo"}</DialogTitle>
          <DialogDescription>
            Complete los detalles para generar la orden de trabajo. Los precios no se incluyen en este documento.
            {workOrder?.quoteNumber && (
              <span className="ml-2 text-muted-foreground">Generada desde la cotización <strong>{workOrder.quoteNumber}</strong>.</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <div className="space-y-6 px-6 overflow-y-auto max-h-[calc(80vh-150px)]">

              {/* Información General */}
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Información General</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                  {/* Cliente (combobox) */}
                  <FormField name="clientName" control={form.control} render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Cliente *</FormLabel>
                      <Popover open={isClientComboboxOpen} onOpenChange={setIsClientComboboxOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant="outline" role="combobox"
                              className={cn("w-full justify-between font-normal", !field.value && "text-muted-foreground")}>
                              <span className="truncate">{field.value || "Seleccionar o escribir un cliente"}</span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                          <Command filter={(value, search) => {
                            const name = value.split("||")[0];
                            return name.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                          }}>
                            <CommandInput placeholder="Buscar cliente..." onValueChange={(s) => field.onChange(s)} />
                            <CommandList>
                              <CommandEmpty>No se encontró cliente.</CommandEmpty>
                              <CommandGroup>
                                {clients.map((client) => (
                                  <CommandItem key={client.id} value={`${client.name}||${client.rfc}`}
                                    onSelect={() => {
                                      form.setValue("clientName", client.name);
                                      form.setValue("clientPhone", client.phone);
                                      form.setValue("clientAddress", client.address || "");
                                      field.onChange(client.name);
                                      setIsClientComboboxOpen(false);
                                    }}>
                                    <Check className={cn("mr-2 h-4 w-4", client.name === field.value ? "opacity-100" : "opacity-0")} />
                                    <div><p>{client.name}</p><p className="text-xs text-muted-foreground">{client.rfc}</p></div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField name="clientPhone" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Teléfono *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="responsable" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Responsable / Contacto</FormLabel><FormControl><Input placeholder="Nombre del responsable" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="clientAddress" control={form.control} render={({ field }) => (
                    <FormItem className="lg:col-span-2"><FormLabel>Dirección del Cliente *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="serviceAddress" control={form.control} render={({ field }) => (
                    <FormItem className="lg:col-span-2"><FormLabel>Dirección del Servicio (Lugar de ejecución)</FormLabel><FormControl><Input placeholder="Dejar vacío si es la misma" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="date" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Fecha de Emisión</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="technician" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Técnico Asignado</FormLabel><FormControl><Input placeholder="Nombre del técnico" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField name="status" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Estado de la OT</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="Pendiente">Pendiente</SelectItem>
                          <SelectItem value="En Proceso">En Proceso</SelectItem>
                          <SelectItem value="Completado">Completado</SelectItem>
                          <SelectItem value="Cancelado">Cancelado</SelectItem>
                        </SelectContent>
                      </Select>
                    <FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* Detalles del Servicio */}
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Detalles del Servicio</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField name="tipoServicio" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Tipo de Servicio</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="tipoTrabajo" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Tipo de Trabajo</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField name="equipoLugar" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Equipo / Lugar</FormLabel><FormControl><Input {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* Items — SIN precio */}
              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Ítems de la Orden de Trabajo</h3>
                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2">
                      <FormField name={`items.${index}.description`} control={form.control} render={({ field }) => (
                        <FormItem className="flex-grow"><FormLabel className="text-xs">Descripción</FormLabel>
                          <FormControl><Textarea placeholder="Descripción del ítem" className="min-h-[38px] h-9 resize-y py-1.5" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField name={`items.${index}.unidad`} control={form.control} render={({ field }) => (
                        <FormItem className="w-20"><FormLabel className="text-xs">Unidad</FormLabel>
                          <FormControl><Input placeholder="PZA" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField name={`items.${index}.quantity`} control={form.control} render={({ field }) => (
                        <FormItem className="w-24"><FormLabel className="text-xs">Cant.</FormLabel>
                          <FormControl><Input type="number" placeholder="1" {...field} /></FormControl>
                        </FormItem>
                      )} />
                      <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                  <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-[300px] justify-between">
                        Agregar ítem del catálogo...
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre o SKU..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron ítems.</CommandEmpty>
                          <CommandGroup heading="Servicios">
                            {services.map((s) => (
                              <CommandItem key={s.id} value={`${s.title} ${s.sku}`} onSelect={() => handleItemSelect(s.id!, "service")}>
                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />{s.title}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          <CommandGroup heading="Refacciones">
                            {spareParts.map((p) => (
                              <CommandItem key={p.id} value={`${p.name} ${p.brand} ${p.sku}`} onSelect={() => handleItemSelect(p.id!, "part")}>
                                <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />{p.name} ({p.brand})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button type="button" variant="outline" onClick={() => append({ description: "", quantity: 1, unidad: "PZA" })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Agregar Ítem Manual
                  </Button>
                </div>
                {form.formState.errors.items && (
                  <p className="text-sm font-medium text-destructive mt-2">
                    {form.formState.errors.items?.root?.message || form.formState.errors.items.message}
                  </p>
                )}
              </div>

              {/* Observaciones */}
              <div className="border p-4 rounded-lg">
                <FormField name="observations" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comentarios y Diagnóstico</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Añadir notas, observaciones o diagnóstico..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t mt-6">
              <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Orden de Trabajo
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
