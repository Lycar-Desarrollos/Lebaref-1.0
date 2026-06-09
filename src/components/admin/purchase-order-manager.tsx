

"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlusCircle, Download, Trash2, Edit, Loader2, FileSpreadsheet, ArrowUpDown, Calendar as CalendarIcon, Eraser, ChevronDown } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, runTransaction, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "../ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import type { Quote } from "./quote-manager";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type PurchaseOrderItem = {
  description: string;
  unit: string;
  quantity: number;
  price: number;
};

export type PurchaseOrder = {
  id: string;
  purchaseOrderNumber: string;
  date: string;
  supplierId?: string;
  supplierName: string;
  supplierDetails: string;
  billToDetails: string;
  quoteId?: string;
  tipoPago?: string;
  diasCredito?: string;
  paymentDueDate?: string;
  status: "Borrador" | "Enviada" | "Recibida Parcialmente" | "Recibida";
  items: PurchaseOrderItem[];
  observations?: string;
  discountPercentage?: number;
  subtotal: number;
  iva: number;
  total: number;
  userId: string;
};

type UserProfile = {
  role: 'admin' | 'employee';
  userCode: string;
  purchaseOrderCounter: number;
};

const downloadPDF = async (po: PurchaseOrder, quotes: Quote[]) => {
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const pageMargin = 14;

    let logoDataUrl: string | null = null;
    try {
        const logoUrl = 'https://res.cloudinary.com/ddbgqzdpj/image/upload/v1772466958/WhatsApp_Image_2026-02-27_at_1.26.01_PM_aq5j1w.jpg';
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
    
    // Header
    if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', pageMargin, 12, 20, 15);
    }
    
    doc.setFont("helvetica", "bold").setFontSize(14).setTextColor(0, 0, 0);
    doc.text("ORDEN DE COMPRA", pageWidth - pageMargin, 20, { align: 'right' });

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0, 0, 0);
    const poDate = po.date ? new Date(po.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}) : 'N/A';
    doc.text(`FECHA: ${poDate}`, pageWidth - pageMargin, 28, { align: 'right' });
    doc.text(`ORDEN DE COMPRA NO.: ${po.purchaseOrderNumber}`, pageWidth - pageMargin, 32, { align: 'right' });

    // Addresses
    autoTable(doc, {
        body: [
            [
                { content: 'FACTURAR A:', styles: { fontStyle: 'bold', textColor: [0,0,0], fontSize: 8 } },
                { content: 'ENVIAR A:', styles: { fontStyle: 'bold', textColor: [0,0,0], fontSize: 8 } }
            ],
            [
                { content: po.billToDetails, styles: { fontSize: 8, overflow: 'linebreak' } },
                { content: po.supplierDetails, styles: { fontSize: 8, overflow: 'linebreak' } }
            ]
        ],
        theme: 'plain',
        startY: 40,
        tableWidth: 'auto',
        margin: { left: pageMargin, right: pageMargin }
    });
    
    const linkedQuote = quotes.find(q => q.id === po.quoteId);
    const quoteDisplay = linkedQuote ? linkedQuote.quoteNumber : 'N/A';
    
    const paymentDueDate = po.paymentDueDate
        ? new Date(po.paymentDueDate.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'})
        : 'N/A';

    // Details Bar
    autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 5,
        body: [[
            { content: `COTIZACIÓN:\n${quoteDisplay}`},
            { content: `TIPO DE PAGO:\n${po.tipoPago || 'N/A'}`},
            { content: `DÍAS DE CRÉDITO:\n${po.diasCredito || '0'}`},
            { content: `FECHA APROX ENTREGA:\n${paymentDueDate}`},
        ]],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
        margin: { left: pageMargin, right: pageMargin },
    });

    // Items Table
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 5,
      head: [[
            { content: 'ARTÍCULO NO.', styles: { halign: 'center' } },
            { content: 'DESCRIPCIÓN', styles: { halign: 'left' } },
            { content: 'UNIDAD', styles: { halign: 'center' } },
            { content: 'CANTIDAD', styles: { halign: 'right' } },
            { content: 'PRECIO POR UNIDAD', styles: { halign: 'right' } },
            { content: 'TOTAL', styles: { halign: 'right' } }
      ]],
      body: po.items.map((item, index) => [
        index + 1,
        item.description, 
        item.unit || 'PZA',
        (item.quantity || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        `$${(item.price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `$${((item.quantity || 0) * (item.price || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0], fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7, overflow: 'linebreak' },
      columnStyles: {
            0: { cellWidth: 20, halign: 'center' },
            1: { cellWidth: 'auto', halign: 'left' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 25, halign: 'right' },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 30, halign: 'right' },
      },
      margin: { left: pageMargin, right: pageMargin },
    });

    let finalY = (doc as any).lastAutoTable.finalY;

    // Observations
    if (po.observations) {
      autoTable(doc, {
        startY: finalY + 5,
        body: [
          [{ content: 'Observaciones / Instrucciones:', styles: { fontStyle: 'bold', fontSize: 8 } }],
          [{ content: po.observations }]
        ],
        theme: 'plain',
        styles: { fontSize: 8, overflow: 'linebreak' },
        margin: { left: pageMargin, right: pageMargin }
      });
      finalY = (doc as any).lastAutoTable.finalY;
    }
    
    // Totals
    const subtotal = po.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const discountAmount = subtotal * ((po.discountPercentage || 0) / 100);
    const subTotalAfterDiscount = subtotal - discountAmount;
    const ivaAmount = subTotalAfterDiscount * (po.iva / 100);
    const total = subTotalAfterDiscount + ivaAmount;

    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0,0,0);
    const labelsX = pageWidth - pageMargin - 80;
    const valuesX = pageWidth - pageMargin;
    const totalsY = finalY + 10;
    
    doc.text("SUBTOTAL", labelsX, totalsY, { align: 'left'});
    doc.text(`$${subTotalAfterDiscount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valuesX, totalsY, { align: 'right'});

    doc.text("IVA", labelsX, totalsY + 5, { align: 'left'});
    doc.text(`$${ivaAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valuesX, totalsY + 5, { align: 'right'});
    
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL", labelsX, totalsY + 10, { align: 'left'});
    doc.text(`$${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, valuesX, totalsY + 10, { align: 'right'});

    finalY = totalsY + 10;

    // Signature
    let signatureY = finalY + 30;
    if (signatureY > pageHeight - 30) {
        doc.addPage();
        signatureY = pageMargin + 20;
    }
    doc.setDrawColor(0,0,0);
    doc.line(pageMargin, signatureY, pageMargin + 80, signatureY); 
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(0,0,0);
    doc.text('FIRMA AUTORIZADA', pageMargin + 40, signatureY + 5, { align: 'center' });
    
    doc.save(`${po.purchaseOrderNumber}.pdf`);
};

const downloadExcel = (po: PurchaseOrder) => {
    const poId = po.purchaseOrderNumber;
    
    const paymentDueDate = po.paymentDueDate
        ? new Date(po.paymentDueDate.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'})
        : 'N/A';

    const poData = [
      ["Orden de Compra:", poId],
      ["Proveedor:", po.supplierName],
      ["Fecha:", po.date ? new Date(po.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}) : ''],
      ["Fecha de Pago:", paymentDueDate],
      ["Estado:", po.status],
      ["Tipo de Pago:", po.tipoPago || ''],
      ["Días de Crédito:", po.diasCredito || '0'],
    ];

    const ws = XLSX.utils.aoa_to_sheet(poData);

    XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1}); 

    const addresses = [
        ["FACTURAR A:", "ENVIAR A:"],
        [po.billToDetails, po.supplierDetails]
    ];
    XLSX.utils.sheet_add_aoa(ws, addresses, {origin: -1});

    XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1}); 
    
    const itemsHeader = ["Descripción", "Unidad", "Cantidad", "Precio Unitario", "Total"];
    const itemsData = po.items.map(item => [
      item.description,
      item.unit || 'PZA',
      item.quantity,
      item.price,
      (item.quantity || 0) * (item.price || 0)
    ]);

    XLSX.utils.sheet_add_aoa(ws, [itemsHeader], {origin: -1});
    XLSX.utils.sheet_add_json(ws, itemsData, {origin: -1, skipHeader: true});

    const subtotal = po.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const discountAmount = subtotal * ((po.discountPercentage || 0) / 100);
    const subTotalAfterDiscount = subtotal - discountAmount;
    const ivaAmount = subTotalAfterDiscount * (po.iva / 100);
    const total = subTotalAfterDiscount + ivaAmount;

    const totalsData = [
        [],
        ["", "", "", "Subtotal", subtotal],
        ["", "", "", `Descuento (${po.discountPercentage || 0}%)`, -discountAmount],
        ["", "", "", `IVA (${po.iva}%)`, ivaAmount],
        ["", "", "", "Total", total],
    ];

    XLSX.utils.sheet_add_aoa(ws, totalsData, {origin: -1});

     XLSX.utils.sheet_add_aoa(ws, [[]], {origin: -1});
     XLSX.utils.sheet_add_aoa(ws, [["Observaciones:", po.observations || '']], {origin: -1});

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orden de Compra");
    XLSX.writeFile(wb, `${poId}.xlsx`);
};

export function PurchaseOrderManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsProfileLoading(false);
      setIsLoading(false);
      setPurchaseOrders([]);
      return;
    }
    const profileUnsub = onSnapshot(doc(db, "users", user.uid), (doc) => {
        if (doc.exists()) {
            setUserProfile(doc.data() as UserProfile);
        }
        setIsProfileLoading(false);
    });
    return () => profileUnsub();
  }, [user, authIsLoading]);


  useEffect(() => {
    if (!user || !userProfile) {
        if (!isProfileLoading) setIsLoading(false);
        return;
    };

    setIsLoading(true);
    const is_admin = userProfile.role === 'admin';
    const basePoQuery = collection(db, "purchase_orders");
    const q = is_admin ? query(basePoQuery) : query(basePoQuery, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const poData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseOrder));
        setPurchaseOrders(poData);
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'purchase_orders',
            operation: 'list',
        }));
        toast({ title: "Error al cargar", description: "No se pudieron cargar las órdenes de compra.", variant: "destructive"});
        setIsLoading(false);
    });

    const qQuotes = collection(db, "quotes");
    const unsubscribeQuotes = onSnapshot(qQuotes, (snapshot) => {
        const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
        setQuotes(quotesData);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'quotes',
            operation: 'list',
        }));
    });


    return () => {
      unsubscribe();
      unsubscribeQuotes();
    };
  }, [user, userProfile, isProfileLoading, toast]);

    const filteredPOs = useMemo(() => {
        if (!date?.from) return purchaseOrders;
        
        const fromDate = new Date(date.from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = date.to ? new Date(date.to) : new Date(date.from);
        toDate.setHours(23, 59, 59, 999);

        return purchaseOrders.filter(po => {
            if (!po.date) return false;
            const poDate = new Date(po.date.replace(/-/g, '\/'));
            return poDate >= fromDate && poDate <= toDate;
        });
    }, [purchaseOrders, date]);


  const handleSave = useCallback(async (poData: any) => {
    if (!user) return;
    try {
        if (selectedPO) { 
            const poRef = doc(db, "purchase_orders", selectedPO.id);
            await updateDoc(poRef, poData);
            toast({ title: "Orden de Compra Actualizada", description: `La orden para ${poData.supplierName} ha sido actualizada.` });
        } else { 
            await runTransaction(db, async (transaction) => {
                if (!user) throw new Error("User not authenticated");
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await transaction.get(userDocRef);

                if (!userDoc.exists()) {
                    throw new Error("User profile does not exist.");
                }
                const userData = userDoc.data();
                const newPoCounter = (userData.purchaseOrderCounter || 0) + 1;
                const userCode = userData.userCode || "00";
        
                const newPoNumber = `OC${userCode}-${String(newPoCounter).padStart(4, '0')}`;
                
                transaction.update(userDocRef, { purchaseOrderCounter: newPoCounter });
            
                const newPoRef = doc(collection(db, "purchase_orders"));
                transaction.set(newPoRef, { ...poData, purchaseOrderNumber: newPoNumber, userId: user.uid });
            });
            toast({ title: "Orden de Compra Creada", description: `Una nueva orden ha sido creada.` });
        }
        setIsFormOpen(false);
        setSelectedPO(null);
    } catch (error) {
        console.error("Error saving purchase order:", error);
        toast({ title: "Error al guardar", description: "No se pudo guardar la orden.", variant: "destructive"});
    }
  }, [selectedPO, toast, user]);
  
  const handleDelete = useCallback(async (id: string) => {
    try {
        await deleteDoc(doc(db, "purchase_orders", id));
        toast({ title: "Orden Eliminada", description: `La orden ha sido eliminada.` });
    } catch (error) {
        console.error("Error deleting purchase order:", error);
        toast({ title: "Error al eliminar", description: "No se pudo eliminar la orden.", variant: "destructive" });
    }
  }, [toast]);

  const handleStatusChange = useCallback(async (po: PurchaseOrder, newStatus: PurchaseOrder['status']) => {
    try {
        const poRef = doc(db, "purchase_orders", po.id);
        await updateDoc(poRef, { status: newStatus });
        toast({ title: "Estado Actualizado", description: `La orden para ${po.supplierName} ahora está ${newStatus}.` });
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: "Error al actualizar", description: "No se pudo cambiar el estado.", variant: "destructive"});
    }
  }, [toast]);

  const columns: ColumnDef<PurchaseOrder>[] = useMemo(
    () => [
      { 
        accessorKey: "purchaseOrderNumber", 
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                ID <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
          return row.original.purchaseOrderNumber || 'N/A';
        }
      },
      { accessorKey: "supplierName", header: "Proveedor" },
      { 
        accessorKey: "date", 
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Fecha <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            const date = row.original.date;
            if (!date) return 'N/A';
            const localDate = new Date(date.replace(/-/g, '\/'));
            return localDate.toLocaleDateString('es-MX', {timeZone: 'UTC'});
        } 
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => `$${row.original.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
      { accessorKey: "status", header: "Estado", cell: ({row}) => <Badge>{row.original.status}</Badge> },
      {
        id: "actions",
        cell: ({ row }) => {
           const po = row.original;
           return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setSelectedPO(po); setIsFormOpen(true); }}>
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => await downloadPDF(po, quotes)}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExcel(po)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar Excel
                </DropdownMenuItem>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Cambiar Estado</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup 
                            value={po.status} 
                            onValueChange={(newStatus) => handleStatusChange(po, newStatus as PurchaseOrder['status'])}
                         >
                             <DropdownMenuRadioItem value="Borrador">Borrador</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Enviada">Enviada</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Recibida Parcialmente">Recibida Parcialmente</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Recibida">Recibida</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-500">
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción eliminará permanentemente la orden de compra.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(po.id)} className="bg-destructive hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
           );
        },
      },
    ],
    [handleDelete, handleStatusChange, quotes]
  );

  const table = useReactTable({
    data: filteredPOs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: {
        pagination: {
            pageSize: 10,
        }
    },
    state: {
      globalFilter: filter,
      sorting,
      columnFilters,
    },
    onGlobalFilterChange: setFilter,
  });

  if (isLoading || authIsLoading || isProfileLoading) {
    return <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por ID o proveedor..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="max-w-sm"
            />
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "d 'de' LLL, y", { locale: es })} -{" "}
                                    {format(date.to, "d 'de' LLL, y", { locale: es })}
                                </>
                            ) : (
                                format(date.from, "d 'de' LLL, y", { locale: es })
                            )
                        ) : (
                            <span>Filtrar por fecha...</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={1}
                        locale={es}
                    />
                </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="capitalize">
                    {(table.getColumn("status")?.getFilterValue() as string) ?? "Estado"}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={
                      (table.getColumn("status")?.getFilterValue() as string) ?? "all"
                    }
                    onValueChange={(value) => {
                      table.getColumn("status")?.setFilterValue(
                        value === "all" ? undefined : value
                      );
                    }}
                  >
                    <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Borrador">Borrador</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Enviada">Enviada</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Recibida Parcialmente">Recibida Parcialmente</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Recibida">Recibida</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            {(filter || date || table.getColumn('status')?.getFilterValue()) && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                    setFilter("");
                                    setDate(undefined);
                                    table.getColumn('status')?.setFilterValue(undefined);
                                }}
                                className="h-9 w-9"
                            >
                                <Eraser className="h-4 w-4" />
                                <span className="sr-only">Limpiar filtros</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Limpiar filtros</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
        <Button onClick={() => { setSelectedPO(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Orden de Compra
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
             {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                    ))}
                </TableRow>
                ))
            ) : (
                <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                        No hay órdenes de compra. Empieza creando una.
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
      <PurchaseOrderForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave}
        purchaseOrder={selectedPO}
        userRole={userProfile?.role}
        user={user}
        purchaseOrders={purchaseOrders}
      />
    </div>
  );
}

    
