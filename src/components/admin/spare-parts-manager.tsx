

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
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Textarea } from "../ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";


const sparePartSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, { message: "El nombre debe tener al menos 3 caracteres." }),
  brand: z.string().min(2, { message: "La marca es requerida." }),
  sku: z.string().min(3, { message: "El SKU es requerido." }),
  price: z.coerce.number().min(0, { message: "El precio es requerido y no puede ser negativo." }),
  description: z.string().min(10, { message: "La descripción debe tener al menos 10 caracteres." }),
});

export type SparePart = z.infer<typeof sparePartSchema>;


export function SparePartsManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SparePart | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) {
      setIsLoading(true);
      return;
    }
    if (!user) {
      setIsLoading(false);
      setSpareParts([]);
      return;
    }
    const q = collection(db, "spare_parts");
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const partsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SparePart));
        setSpareParts(partsData);
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'spare_parts',
            operation: 'list',
        }));
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, authIsLoading, toast]);

  const handleSavePart = useCallback(async (data: Omit<SparePart, 'id'>) => {
    try {
        if (selectedPart && selectedPart.id) {
            const partDoc = doc(db, "spare_parts", selectedPart.id);
            await updateDoc(partDoc, data);
            toast({ title: "Refacción Actualizada", description: `La refacción "${data.name}" fue actualizada.` });
        } else {
            await addDoc(collection(db, "spare_parts"), data);
            toast({ title: "Refacción Creada", description: `La refacción "${data.name}" ha sido añadida.` });
        }
        setIsFormOpen(false);
        setSelectedPart(null);
    } catch(error) {
        const operation = selectedPart?.id ? 'update' : 'create';
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: selectedPart?.id ? `spare_parts/${selectedPart.id}` : 'spare_parts',
            operation: operation,
            requestResourceData: data,
        }));
    }
  }, [selectedPart, toast, setIsFormOpen, setSelectedPart]);

  const handleDeletePart = useCallback(async (id?: string) => {
      if(!id) return;
      const partDoc = doc(db, "spare_parts", id);
      try {
        await deleteDoc(partDoc);
        toast({ title: "Refacción Eliminada", variant: "destructive" });
      } catch(error) {
         errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: partDoc.path,
            operation: 'delete',
        }));
      }
  }, [toast]);
  
  const columns: ColumnDef<SparePart>[] = useMemo(() => [
      { accessorKey: "name", header: "Nombre" },
      { accessorKey: "brand", header: "Marca" },
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "price", header: "Precio", cell: ({ row }) => `$${row.original.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
      { id: "actions",
        cell: ({ row }) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => { setSelectedPart(row.original); setIsFormOpen(true); }}>
                        <Edit className="mr-2 h-4 w-4"/> Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-500">
                                <Trash2 className="mr-2 h-4 w-4"/> Eliminar
                            </DropdownMenuItem>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                <AlertDialogDescription>Esta acción no se puede deshacer. La refacción será eliminada permanentemente.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeletePart(row.original.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </DropdownMenuContent>
            </DropdownMenu>
        )
      }
  ], [handleDeletePart]);
  
  const table = useReactTable({ 
    data: spareParts, 
    columns, 
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
        pagination: {
            pageSize: 10,
        }
    },
     state: {
      globalFilter: filter,
    },
    onGlobalFilterChange: setFilter,
});
  
  if (isLoading && authIsLoading) {
    return <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
             <Input
                placeholder="Buscar refacción por nombre..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-sm"
            />
            <Button onClick={() => { setSelectedPart(null); setIsFormOpen(true);}}>
                <PlusCircle className="mr-2 h-4 w-4" /> Agregar Refacción
            </Button>
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map(headerGroup => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map(row => (
                            <TableRow key={row.id}>
                                {row.getVisibleCells().map(cell => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                No hay refacciones. Empieza creando una.
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>

        <div className="flex items-center justify-end space-x-2 py-4">
            <Button
                variant="outline"
                size="sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
            >
                Anterior
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
            >
                Siguiente
            </Button>
        </div>

      <SparePartFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSavePart}
        part={selectedPart}
      />
    </div>
  );
}


interface SparePartFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<SparePart, 'id'>) => void;
  part: SparePart | null;
}

function SparePartFormDialog({ isOpen, onOpenChange, onSave, part }: SparePartFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const form = useForm<z.infer<typeof sparePartSchema>>({
        resolver: zodResolver(sparePartSchema),
        defaultValues: { name: "", brand: "", sku: "", price: 0, description: "" }
    });

    useEffect(() => {
        if (isOpen) {
          if (part) {
            form.reset(part);
          } else {
            form.reset({ name: "", brand: "", sku: "", price: 0, description: "" });
          }
        }
      }, [part, isOpen, form]);

    const handleSubmit = async (data: z.infer<typeof sparePartSchema>) => {
        setIsSubmitting(true);
        await onSave(data);
        setIsSubmitting(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{part ? 'Editar Refacción' : 'Agregar Nueva Refacción'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                             <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Refacción</FormLabel>
                                    <FormControl><Input placeholder="Ej: Termostato" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="brand" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Marca</FormLabel>
                                    <FormControl><Input placeholder="Ej: Robertshaw" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="sku" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>SKU</FormLabel>
                                    <FormControl><Input placeholder="Ej: RS-5300-123" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Precio</FormLabel>
                                    <FormControl><Input type="number" step="0.01" placeholder="Ej: 550.00" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Descripción</FormLabel>
                                <FormControl><Textarea placeholder="Describa la refacción, para qué equipos funciona, etc." {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="ghost">Cancelar</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
