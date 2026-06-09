

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useCallback } from "react";
import { Loader2, PlusCircle, MoreHorizontal, Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Switch } from "@/components/ui/switch";

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "El nombre es requerido." }),
  contactPerson: z.string().optional(),
  phone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos." }),
  email: z.string().email({ message: "Correo electrónico inválido." }).optional().or(z.literal('')),
  address: z.string().optional(),
  rfc: z.string().optional(),
  givesCredit: z.boolean().default(false),
  creditTime: z.string().optional(),
}).refine(data => {
    if (data.givesCredit && (!data.creditTime || data.creditTime.trim() === '')) {
        return false;
    }
    return true;
}, {
    message: "Los días de crédito son requeridos si se ofrece crédito.",
    path: ["creditTime"],
});


export type Supplier = z.infer<typeof supplierSchema> & { id: string, createdAt: any };

export function SupplierManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsLoading(false);
      setSuppliers([]);
      return;
    }
    
    setIsLoading(true);
    const suppliersQuery = collection(db, "suppliers");
    const unsubscribe = onSnapshot(suppliersQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        setSuppliers(data.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'suppliers', operation: 'list' }));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authIsLoading, toast]);

  const handleSaveSupplier = useCallback(async (data: Omit<Supplier, 'id' | 'createdAt'>) => {
    if (selectedSupplier?.id) {
        const supplierDoc = doc(db, "suppliers", selectedSupplier.id);
        try {
            await updateDoc(supplierDoc, data);
            toast({ title: "Proveedor Actualizado", description: "La información del proveedor ha sido actualizada." });
        } catch(error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: supplierDoc.path,
                operation: 'update',
                requestResourceData: data,
            }));
        }
    } else {
        const supplierData = { ...data, createdAt: serverTimestamp() };
        const suppliersCollection = collection(db, "suppliers");
        try {
            await addDoc(suppliersCollection, supplierData);
            toast({ title: "Proveedor Creado", description: "Un nuevo proveedor ha sido añadido." });
        } catch(error) {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: suppliersCollection.path,
                operation: 'create',
                requestResourceData: supplierData,
            }));
        }
    }
    setIsFormOpen(false);
    setSelectedSupplier(null);
  }, [selectedSupplier, toast, setIsFormOpen, setSelectedSupplier]);

  const handleDeleteSupplier = useCallback(async (id: string) => {
    const supplierDoc = doc(db, "suppliers", id);
    try {
      await deleteDoc(supplierDoc);
      toast({ title: "Proveedor Eliminado", variant: "destructive" });
    } catch(error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: supplierDoc.path,
            operation: 'delete',
        }));
    }
  }, [toast]);
  
  const columns: ColumnDef<Supplier>[] = useMemo(() => [
      { accessorKey: "name", header: "Nombre" },
      { accessorKey: "contactPerson", header: "Contacto" },
      { accessorKey: "phone", header: "Teléfono" },
      { accessorKey: "email", header: "Correo Electrónico" },
      { accessorKey: "rfc", header: "RFC" },
      { accessorKey: "creditTime", header: "Condiciones" },
      { id: "actions",
        cell: ({ row }) => {
            const supplier = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => { setSelectedSupplier(supplier); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-500"><Trash2 className="mr-2 h-4 w-4"/> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción eliminará el proveedor permanentemente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSupplier(supplier.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
      }
  ], [handleDeleteSupplier]);
  
  const table = useReactTable({ 
    data: suppliers, 
    columns, 
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
        pagination: {
            pageSize: 10,
        }
    },
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
  });

  if (isLoading && authIsLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
             <Input placeholder="Buscar por nombre, teléfono o RFC..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm"/>
            <Button onClick={() => { setSelectedSupplier(null); setIsFormOpen(true);}}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Proveedor</Button>
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>{table.getHeaderGroups().map(headerGroup => (<TableRow key={headerGroup.id}>{headerGroup.headers.map(header => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>))}</TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (table.getRowModel().rows.map(row => (<TableRow key={row.id}>{row.getVisibleCells().map(cell => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay proveedores. Empieza agregando uno.</TableCell></TableRow>)}
                </TableBody>
            </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
        </div>

      <SupplierFormDialog isOpen={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSaveSupplier} supplier={selectedSupplier} />
    </div>
  );
}

interface SupplierFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<Supplier, 'id' | 'createdAt'>) => void;
  supplier: Supplier | null;
}

function SupplierFormDialog({ isOpen, onOpenChange, onSave, supplier }: SupplierFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<z.infer<typeof supplierSchema>>({
        resolver: zodResolver(supplierSchema),
        defaultValues: { name: "", contactPerson: "", phone: "", email: "", address: "", rfc: "", creditTime: "", givesCredit: false }
    });

    const givesCredit = form.watch("givesCredit");

    useEffect(() => {
        if (isOpen) {
          if (supplier) {
            const hasCredit = supplier.creditTime?.toLowerCase() !== 'contado' && !!supplier.creditTime;
            form.reset({
                ...supplier,
                givesCredit: hasCredit,
                creditTime: hasCredit ? supplier.creditTime : "",
            });
          } else {
            form.reset({ name: "", contactPerson: "", phone: "", email: "", address: "", rfc: "", creditTime: "", givesCredit: false });
          }
        }
      }, [supplier, isOpen, form]);

    const handleSubmit = async (data: z.infer<typeof supplierSchema>) => {
        setIsSubmitting(true);
        const { givesCredit, ...saveData } = data;
        if (!givesCredit) {
            saveData.creditTime = 'Contado';
        }
        await onSave(saveData as any);
        setIsSubmitting(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{supplier ? 'Editar Proveedor' : 'Agregar Nuevo Proveedor'}</DialogTitle>
                    <DialogDescription>Completa los detalles del proveedor.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nombre o Razón Social</FormLabel><FormControl><Input placeholder="Nombre de la empresa proveedora" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Persona de Contacto (Opcional)</FormLabel><FormControl><Input placeholder="Nombre del contacto principal" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input placeholder="Número de contacto" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Correo Electrónico (Opcional)</FormLabel><FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="rfc" render={({ field }) => ( <FormItem><FormLabel>RFC (Opcional)</FormLabel><FormControl><Input placeholder="Registro Federal de Contribuyentes" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Dirección (Opcional)</FormLabel><FormControl><Input placeholder="Dirección completa del proveedor" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 items-center">
                             <FormField
                                control={form.control}
                                name="givesCredit"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                        <FormLabel className="m-0">¿Ofrece Crédito?</FormLabel>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            {givesCredit && (
                                <FormField
                                    control={form.control}
                                    name="creditTime"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Días de Crédito</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: 30" {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                        </div>

                         <DialogFooter className="sticky bottom-0 bg-background pt-4">
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {supplier ? 'Guardar Cambios' : 'Crear Proveedor'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}


    
