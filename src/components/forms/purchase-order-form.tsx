

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
import { useEffect, useState, useMemo } from "react";
import { Loader2, PlusCircle, Trash2, Check, ChevronsUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import type { PurchaseOrder } from "@/components/admin/purchase-order-manager";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Separator } from "../ui/separator";
import { Supplier } from "../admin/supplier-manager";
import { SparePart } from "../admin/spare-parts-manager";
import type { Quote } from "@/components/admin/quote-manager";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import type { User } from "firebase/auth";


const poItemSchema = z.object({
  description: z.string().min(1, "La descripción es requerida."),
  unit: z.string().optional(),
  quantity: z.coerce.number().min(1, "La cantidad debe ser al menos 1."),
  price: z.coerce.number().min(0, "El precio no puede ser negativo."),
});

const poFormSchema = z.object({
  supplierId: z.string().optional(),
  supplierName: z.string().min(1, "Debe seleccionar un proveedor."),
  supplierDetails: z.string().min(1, "Los detalles del proveedor son requeridos."),
  billToDetails: z.string().min(1, "Los detalles de facturación son requeridos."),
  date: z.string().min(1, "La fecha es requerida."),
  status: z.enum(["Borrador", "Enviada", "Recibida Parcialmente", "Recibida"]),
  items: z.array(poItemSchema).min(1, "Debe agregar al menos un ítem."),
  quoteId: z.string().optional(),
  tipoPago: z.string().optional(),
  diasCredito: z.string().optional(),
  paymentDueDate: z.string().optional(),
  observations: z.string().optional(),
  discountPercentage: z.coerce.number().min(0).max(100).optional(),
  iva: z.coerce.number().min(0, "El IVA no puede ser negativo.").default(16),
});

type POFormValues = z.infer<typeof poFormSchema>;

interface PurchaseOrderFormProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (po: any) => void;
  purchaseOrder: Partial<PurchaseOrder> | null;
  userRole?: 'admin' | 'employee';
  user?: User | null;
  purchaseOrders: PurchaseOrder[];
}

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const billToDefault = `Attn: Lebaref
LEBAREF SERVICIO DE MANTENIMIENTO GENERAL S.A. DE C.V.
Calle 33 No. 259 Num int 2 por 12 y 14 Col. Santa María Chuburna CP. 97138, Mérida, Yucatán
990 101 02 21
corporativo@lebaref.com`;

const defaultValues: POFormValues = {
  supplierName: "",
  supplierDetails: "",
  billToDetails: billToDefault,
  date: formatDate(new Date()),
  paymentDueDate: formatDate(new Date()),
  status: "Borrador",
  items: [],
  iva: 16,
  quoteId: "",
  tipoPago: "",
  diasCredito: "",
  observations: "",
  discountPercentage: 0,
};

export function PurchaseOrderForm({ isOpen, onOpenChange, onSave, purchaseOrder, userRole, user, purchaseOrders }: PurchaseOrderFormProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupplierComboboxOpen, setIsSupplierComboboxOpen] = useState(false);
  const [isItemComboboxOpen, setIsItemComboboxOpen] = useState(false);
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    const qSuppliers = collection(db, "suppliers");
    const unsubSuppliers = onSnapshot(qSuppliers, (snapshot) => {
        setSuppliers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier)));
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'suppliers', operation: 'list' }));
    });
    
    const qParts = collection(db, "spare_parts");
    const unsubParts = onSnapshot(qParts, (snapshot) => {
        setSpareParts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SparePart)));
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'spare_parts', operation: 'list' }));
    });

    const qQuotes = collection(db, "quotes");
    const unsubQuotes = onSnapshot(qQuotes, (snapshot) => {
        setQuotes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote)));
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'quotes', operation: 'list' }));
    });

    return () => {
        unsubSuppliers();
        unsubParts();
        unsubQuotes();
    };
  }, []);

  const form = useForm<POFormValues>({
    resolver: zodResolver(poFormSchema),
    defaultValues,
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const issueDate = form.watch('date');
  const creditDays = form.watch('diasCredito');

  useEffect(() => {
    const days = parseInt(creditDays || '0', 10);
    if (!issueDate) return;
    
    const baseDate = new Date(issueDate.replace(/-/g, '\/'));
    
    if (!isNaN(days) && days > 0) {
        baseDate.setDate(baseDate.getDate() + days);
    }
    
    form.setValue('paymentDueDate', formatDate(baseDate));
  }, [issueDate, creditDays, form]);

  useEffect(() => {
    if (isOpen) {
      if (purchaseOrder) {
        form.reset({
          ...defaultValues,
          ...purchaseOrder,
          date: purchaseOrder.date ? purchaseOrder.date.split('T')[0] : formatDate(new Date()),
          paymentDueDate: purchaseOrder.paymentDueDate ? purchaseOrder.paymentDueDate.split('T')[0] : undefined,
          items: purchaseOrder.items || [],
          quoteId: purchaseOrder.quoteId || ""
        });
      } else {
        form.reset(defaultValues);
      }
    }
  }, [purchaseOrder, isOpen, form]);

  const items = form.watch('items');
  const ivaPercentage = form.watch('iva');
  const discountPercentage = form.watch('discountPercentage');
  
  const subtotal = (items || []).reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
  const discountAmount = subtotal * ((discountPercentage || 0) / 100);
  const subtotalAfterDiscount = subtotal - discountAmount;
  const ivaAmount = subtotalAfterDiscount * (ivaPercentage / 100);
  const total = subtotalAfterDiscount + ivaAmount;

  const onSubmit = async (data: POFormValues) => {
    setIsSubmitting(true);
    await onSave({ ...data, subtotal, total });
    setIsSubmitting(false);
    onOpenChange(false);
  };
  
  const handleItemSelect = (itemId: string) => {
    const part = spareParts.find(p => p.id === itemId);
    if (part) {
        append({ description: `${part.name} (${part.brand})`, quantity: 1, price: part.price, unit: 'PZA' });
    }
    setIsItemComboboxOpen(false);
  };

  const handleSupplierSelect = (supplier: Supplier) => {
    form.setValue("supplierId", supplier.id);
    form.setValue("supplierName", supplier.name);
    const details = `${supplier.name}\nRFC: ${supplier.rfc || ''}\n${supplier.address || ''}\nTel: ${supplier.phone || ''}\nCorreo: ${supplier.email || ''}`;
    form.setValue("supplierDetails", details);
    
    const isCredit = supplier.creditTime?.toLowerCase() !== 'contado' && !!supplier.creditTime;
    
    form.setValue("tipoPago", isCredit ? "Crédito" : "Contado");
    form.setValue("diasCredito", isCredit ? (supplier.creditTime || '0') : "0");

    setIsSupplierComboboxOpen(false);
  };

  const filteredQuotes = useMemo(() => {
    return quotes.filter(quote => {
        if (userRole === 'admin') {
            return true;
        }
        return quote.userId === user?.uid;
    });
  }, [quotes, user, userRole]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{purchaseOrder?.id ? `Editar Orden de Compra #${purchaseOrder.purchaseOrderNumber}` : "Crear Orden de Compra"}</DialogTitle>
          <DialogDescription>Complete los detalles para generar la orden de compra.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col">
            <div className="space-y-6 px-6 overflow-y-auto max-h-[calc(80vh-150px)]">
            
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-lg">
                <FormField
                    name="supplierName"
                    control={form.control}
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Proveedor</FormLabel>
                        <Popover open={isSupplierComboboxOpen} onOpenChange={setIsSupplierComboboxOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button variant="outline" role="combobox" className={cn("justify-between", !field.value && "text-muted-foreground")}>
                                        {field.value ? suppliers.find(s => s.name === field.value)?.name : "Seleccionar Proveedor"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command><CommandInput placeholder="Buscar proveedor..." />
                                <CommandList><CommandEmpty>No se encontró proveedor.</CommandEmpty>
                                    <CommandGroup>
                                        {suppliers.map((supplier) => (
                                        <CommandItem value={supplier.name} key={supplier.id} onSelect={() => handleSupplierSelect(supplier)}>
                                            <Check className={cn("mr-2 h-4 w-4", supplier.name === field.value ? "opacity-100" : "opacity-0")}/>
                                            {supplier.name}
                                        </CommandItem>))}
                                    </CommandGroup>
                                </CommandList></Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField name="date" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Fecha de Emisión</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={form.control} name="supplierDetails" render={({ field }) => (
                    <FormItem><FormLabel>Enviar a</FormLabel><FormControl><Textarea className="min-h-[120px] text-sm" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="billToDetails" render={({ field }) => (
                    <FormItem><FormLabel>Facturar a</FormLabel><FormControl><Textarea className="min-h-[120px] text-sm" {...field} disabled={!isAdmin} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 border p-4 rounded-lg">
                    <FormField control={form.control} name="quoteId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Cotización Vinculada</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === 'none' ? '' : value)} value={field.value || 'none'}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar cotización..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Ninguna</SelectItem>
                                    {filteredQuotes.map(q => (
                                        <SelectItem key={q.id} value={q.id}>
                                            {q.quoteNumber} ({q.clientName})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField name="tipoPago" control={form.control} render={({ field }) => (<FormItem><FormLabel>Tipo de Pago</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl></FormItem>)} />
                    <FormField name="diasCredito" control={form.control} render={({ field }) => (<FormItem><FormLabel>Días de Crédito</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl></FormItem>)} />
                    <FormField
                        name="paymentDueDate"
                        control={form.control}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fecha de Pago</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} value={field.value || ''} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
              </div>

              <div className="border p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">Items</h3>
                <div className="space-y-3">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex items-end gap-2">
                            <FormField name={`items.${index}.description`} control={form.control} render={({ field }) => (<FormItem className="flex-grow"><FormLabel className="text-xs">Descripción</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                            <FormField name={`items.${index}.unit`} control={form.control} render={({ field }) => (<FormItem className="w-20"><FormLabel className="text-xs">Unidad</FormLabel><FormControl><Input placeholder="PZA" {...field} /></FormControl></FormItem>)} />
                             <FormField name={`items.${index}.quantity`} control={form.control} render={({ field }) => (<FormItem className="w-24"><FormLabel className="text-xs">Cant.</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>)} />
                             <FormField name={`items.${index}.price`} control={form.control} render={({ field }) => (<FormItem className="w-32"><FormLabel className="text-xs">Precio</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                    ))}
                </div>
                 <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                    <Popover open={isItemComboboxOpen} onOpenChange={setIsItemComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" className="w-[300px] justify-between">Agregar item existente...<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" /></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0"><Command><CommandInput placeholder="Buscar por nombre o SKU..." /><CommandList><CommandEmpty>No se encontraron items.</CommandEmpty>
                            <CommandGroup heading="Refacciones">{spareParts.map((part) => (<CommandItem key={part.id} value={`${part.name} ${part.brand} ${part.sku}`} onSelect={() => handleItemSelect(part.id!)}><Check className="mr-2 h-4 w-4 opacity-0"/>{part.name} ({part.brand})</CommandItem>))}</CommandGroup>
                        </CommandList></Command></PopoverContent>
                    </Popover>

                     <Button type="button" variant="outline" onClick={() => append({ description: '', quantity: 1, price: 0, unit: 'PZA' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Item Manual
                    </Button>
                </div>
                {form.formState.errors.items && <p className="text-sm font-medium text-destructive mt-2">{form.formState.errors.items?.root?.message || form.formState.errors.items.message}</p>}
              </div>
            
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <FormField name="observations" control={form.control} render={({ field }) => (
                    <FormItem><FormLabel>Observaciones / Instrucciones</FormLabel><FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                
                <div className="flex flex-col justify-between p-4 bg-muted/50 rounded-lg">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center font-medium"><span>Subtotal:</span><span>${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <FormField name="discountPercentage" control={form.control} render={({ field }) => (
                            <FormItem className="flex items-center justify-between"><FormLabel className="m-0 p-0">Descuento (%):</FormLabel><FormControl><Input type="number" className="w-20 h-8" {...field} /></FormControl></FormItem>
                        )} />
                        <div className="flex justify-between items-center font-medium text-destructive"><span></span><span>-${discountAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                        <FormField name="iva" control={form.control} render={({ field }) => (
                            <FormItem className="flex items-center justify-between"><FormLabel className="m-0 p-0">IVA (%):</FormLabel>
                                <div className="flex items-center gap-2">
                                <FormControl><Input type="number" className="w-20 h-8" {...field} /></FormControl>
                                <span>${ivaAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </FormItem>
                        )} />
                    </div>
                    <div>
                        <Separator className="my-3 bg-border" />
                        <div className="flex justify-between text-xl font-bold"><span>Total:</span><span>${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 bg-muted/30 border-t mt-6">
                <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Orden de Compra
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    
