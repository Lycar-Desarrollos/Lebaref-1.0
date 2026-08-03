"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnFiltersState,
  SortingState,
  getSortedRowModel,
} from "@tanstack/react-table";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal, PlusCircle, Download, Trash2, Edit, Loader2,
  ArrowUpDown, Calendar as CalendarIcon, Eraser, ChevronDown, Link as LinkIcon,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { WorkOrderForm } from "@/components/forms/work-order-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  collection, onSnapshot, deleteDoc, doc, serverTimestamp,
  runTransaction, updateDoc, query, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────
export type WorkOrderItem = {
  description: string;
  quantity: number;
  unidad?: string;
};

export type WorkOrder = {
  id: string;
  otNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  serviceAddress?: string;
  responsable?: string;
  date: string;
  tipoServicio?: string;
  tipoTrabajo?: string;
  equipoLugar?: string;
  observations?: string;
  items: WorkOrderItem[];
  status: "Pendiente" | "En Proceso" | "Completado" | "Cancelado";
  technician?: string;
  userId: string;
  createdAt?: any;
};

type UserProfile = {
  role: "admin" | "employee";
  userCode: string;
};

// ─── Status badge color ───────────────────────────────────────────────────────
const statusVariant = (status: WorkOrder["status"]) => {
  switch (status) {
    case "Pendiente":    return "secondary";
    case "En Proceso":  return "default";
    case "Completado":  return "outline";
    case "Cancelado":   return "destructive";
    default:            return "secondary";
  }
};

// ─── PDF Generator (sin precios) ─────────────────────────────────────────────
const downloadPDF = (ot: WorkOrder) => {
  const doc = new jsPDF();
  const pageHeight = doc.internal.pageSize.height;
  const pageWidth  = doc.internal.pageSize.width;
  const margin     = 14;
  const bottomMargin = 40;
  const topMargin    = 40;
  let lastPage = 1;

  const drawHeader = () => {
    doc.addImage(LOGO_BASE64, "PNG", margin, 5, 45, 25.3);
    const rx = pageWidth - margin;
    doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(0);
    doc.text("ORDEN DE TRABAJO", rx, 18, { align: "right" });
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(ot.otNumber, rx, 26, { align: "right" });
    doc.setDrawColor(221, 221, 221);
    doc.line(margin, 32, pageWidth - margin, 32);
    doc.setTextColor(0);
  };

  drawHeader();

  const localDate = new Date(ot.date.replace(/-/g, "/"));
  const clientInfo = [
    `Empresa: ${ot.clientName}`,
    `Teléfono: ${ot.clientPhone}`,
    `Dirección: ${ot.clientAddress}`,
  ].join("\n");

  const otInfo = [
    `Fecha: ${localDate.toLocaleDateString("es-MX", { timeZone: "UTC" })}`,
    `Ciudad: Mérida, Yucatán`,
    `Tipo de Servicio: ${ot.tipoServicio || "N/A"}`,
    `Tipo de Trabajo: ${ot.tipoTrabajo || "N/A"}`,
    `Equipo/Lugar: ${ot.equipoLugar || "N/A"}`,
    ot.serviceAddress ? `Lugar de Ejecución: ${ot.serviceAddress}` : null,
    `Técnico: ${ot.technician || "Por asignar"}`,
    ot.quoteNumber ? `Cotización Origen: ${ot.quoteNumber}` : null,
  ].filter(Boolean).join("\n");

  const companyInfo = [
    "Calle 33 No. 259 Num int 2 por 12 y 14",
    "Col. Santa María Chuburna CP. 97138",
    "Mérida, Yucatán",
    "",
    "Oficinas: 990 101 0387",
    "Correo: corporativo@lebaref.com",
    ot.responsable ? `Responsable: ${ot.responsable}` : null,
  ].filter((v) => v !== null).join("\n");

  autoTable(doc, {
    startY: 37,
    head: [["DATOS DEL CLIENTE", "DATOS DE LA ORDEN DE TRABAJO", "CONTACTO LEBAREF"]],
    body: [[clientInfo, otInfo, companyInfo]],
    theme: "grid",
    headStyles: { fontStyle: "bold", fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: 8 },
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak", valign: "top", textColor: [0, 0, 0] },
    columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 65 }, 2: { cellWidth: 57 } },
    margin: { top: topMargin, left: margin, right: margin },
  });

  let finalY = (doc as any).lastAutoTable.finalY;

  // Tabla de ítems — SIN columnas de precio
  autoTable(doc, {
    startY: finalY + 2,
    didDrawPage: (data) => {
      if (data.pageNumber > lastPage) { drawHeader(); lastPage = data.pageNumber; }
    },
    head: [[
      { content: "ARTÍCULO NO.", styles: { halign: "center" } },
      { content: "DESCRIPCIÓN",  styles: { halign: "left" } },
      { content: "UNIDAD",       styles: { halign: "center" } },
      { content: "CANTIDAD",     styles: { halign: "center" } },
    ]],
    body: ot.items.map((item, i) => [
      { content: i + 1,                               styles: { halign: "center" } },
      { content: item.description,                    styles: { halign: "left" } },
      { content: item.unidad || "PZA",                styles: { halign: "center" } },
      { content: (item.quantity || 0).toLocaleString("es-MX", { minimumFractionDigits: 2 }), styles: { halign: "right" } },
    ]),
    theme: "grid",
    headStyles: { fillColor: [41, 71, 121], textColor: 255, fontStyle: "bold", fontSize: 7 },
    bodyStyles: { fontSize: 7, overflow: "linebreak", textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: "auto" },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
    },
    margin: { top: topMargin, bottom: bottomMargin, left: margin, right: margin },
  });

  finalY = (doc as any).lastAutoTable.finalY;

  // Observaciones
  if (ot.observations) {
    if (finalY + 30 > pageHeight - bottomMargin) {
      doc.addPage(); drawHeader(); lastPage++; finalY = topMargin;
    }
    autoTable(doc, {
      startY: finalY + 4,
      body: [
        [{ content: "Comentarios y Diagnóstico:", styles: { fontStyle: "bold", fontSize: 8 } }],
        [{ content: ot.observations, styles: { fontSize: 7, cellPadding: { top: 1, bottom: 4 } } }],
      ],
      theme: "plain",
      styles: { overflow: "linebreak", textColor: [0, 0, 0] },
      margin: { top: topMargin, left: margin, right: margin, bottom: bottomMargin },
      didDrawPage: (data) => {
        if (data.pageNumber > lastPage) { drawHeader(); lastPage = data.pageNumber; }
      },
    });
    finalY = (doc as any).lastAutoTable.finalY;
  }

  // Firma
  if (finalY + 30 > pageHeight - 20) {
    doc.addPage(); drawHeader(); finalY = topMargin;
  }
  const signY = finalY + 20;
  doc.setDrawColor(150, 150, 150);
  doc.line(70, signY, 140, signY);
  doc.setFontSize(9).setFont("helvetica", "normal").setTextColor(0);
  doc.text("FIRMA DE ACEPTACIÓN", 105, signY + 5, { align: "center" });

  // Footer paginación
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setTextColor(0);
    doc.text("Gracias por su preferencia.", margin, pageHeight - 15);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 15, { align: "right" });
  }

  doc.save(`${ot.otNumber}.pdf`);
};

// ─── Main Component ───────────────────────────────────────────────────────────
export function WorkOrderManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  // Load user profile
  useEffect(() => {
    if (authIsLoading) return;
    if (!user) { setIsProfileLoading(false); setIsLoading(false); return; }
    const unsub = onSnapshot(doc(db, "users", user.uid), (d) => {
      if (d.exists()) setUserProfile(d.data() as UserProfile);
      setIsProfileLoading(false);
    });
    return () => unsub();
  }, [user, authIsLoading]);

  // Load work orders
  useEffect(() => {
    if (!user || !userProfile) { if (!isProfileLoading) setIsLoading(false); return; }
    setIsLoading(true);
    const col = collection(db, "ordenes_de_trabajo");
    const q = userProfile.role === "admin" ? col : query(col, where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setWorkOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkOrder)));
      setIsLoading(false);
    }, () => {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "ordenes_de_trabajo", operation: "list" }));
      setIsLoading(false);
    });
    return () => unsub();
  }, [user, userProfile, isProfileLoading]);

  // Date filter
  const filteredWOs = useMemo(() => {
    if (!date?.from) return workOrders;
    const from = new Date(date.from); from.setHours(0, 0, 0, 0);
    const to = date.to ? new Date(date.to) : new Date(date.from); to.setHours(23, 59, 59, 999);
    return workOrders.filter((wo) => {
      if (!wo.date) return false;
      const d = new Date(wo.date.replace(/-/g, "/"));
      return d >= from && d <= to;
    });
  }, [workOrders, date]);

  // Save (create / update)
  const handleSave = useCallback(async (data: Omit<WorkOrder, "id" | "otNumber" | "userId" | "createdAt">) => {
    if (!user) return;
    try {
      if (selectedWO) {
        await updateDoc(doc(db, "ordenes_de_trabajo", selectedWO.id), { ...data });
        toast({ title: "OT Actualizada", description: `La orden de trabajo ${selectedWO.otNumber} ha sido actualizada.` });
      } else {
        await runTransaction(db, async (tx) => {
          const counterRef = doc(db, "counters", "work_orders");
          const counterDoc = await tx.get(counterRef);
          const newNum = (counterDoc.exists() ? counterDoc.data().lastNumber : 0) + 1;
          tx.set(counterRef, { lastNumber: newNum }, { merge: true });
          const newRef = doc(collection(db, "ordenes_de_trabajo"));
          tx.set(newRef, {
            ...data,
            otNumber: `OT-${String(newNum).padStart(4, "0")}`,
            userId: user.uid,
            createdAt: serverTimestamp(),
          });
        });
        toast({ title: "OT Creada", description: "La nueva orden de trabajo ha sido creada." });
      }
      setIsFormOpen(false);
      setSelectedWO(null);
    } catch (error) {
      errorEmitter.emit("permission-error", new FirestorePermissionError({
        path: selectedWO ? `ordenes_de_trabajo/${selectedWO.id}` : "ordenes_de_trabajo",
        operation: selectedWO ? "update" : "write",
      }));
    }
  }, [selectedWO, user, toast]);

  // Delete
  const handleDelete = useCallback(async (id: string) => {
    const ref = doc(db, "ordenes_de_trabajo", id);
    try {
      await deleteDoc(ref);
      toast({ title: "OT Eliminada", description: "La orden de trabajo ha sido eliminada." });
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: ref.path, operation: "delete" }));
    }
  }, [toast]);

  // Status change
  const handleStatusChange = useCallback(async (wo: WorkOrder, newStatus: WorkOrder["status"]) => {
    const ref = doc(db, "ordenes_de_trabajo", wo.id);
    try {
      await updateDoc(ref, { status: newStatus });
      toast({ title: "Estado Actualizado", description: `La OT ${wo.otNumber} ahora está: ${newStatus}.` });
    } catch {
      errorEmitter.emit("permission-error", new FirestorePermissionError({ path: ref.path, operation: "update" }));
    }
  }, [toast]);

  // Columns
  const columns: ColumnDef<WorkOrder>[] = useMemo(() => [
    {
      accessorKey: "otNumber",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          # OT <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-mono font-medium">{row.original.otNumber || "N/A"}</span>,
    },
    {
      accessorKey: "clientName",
      header: "Cliente",
    },
    {
      accessorKey: "tipoServicio",
      header: "Tipo Servicio",
      cell: ({ row }) => row.original.tipoServicio || "—",
    },
    {
      accessorKey: "technician",
      header: "Técnico",
      cell: ({ row }) => row.original.technician || <span className="text-muted-foreground text-xs">Sin asignar</span>,
    },
    {
      accessorKey: "date",
      header: ({ column }) => (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
          Fecha <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        if (!row.original.date) return "N/A";
        return new Date(row.original.date.replace(/-/g, "/")).toLocaleDateString("es-MX", { timeZone: "UTC" });
      },
    },
    {
      accessorKey: "status",
      header: "Estado",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status) as any}>{row.original.status}</Badge>
      ),
    },
    {
      id: "quoteRef",
      header: "COT Origen",
      cell: ({ row }) => row.original.quoteNumber
        ? (
          <Button variant="link" size="sm" className="h-auto p-0 text-xs"
            onClick={() => router.push(`/admin/quotes?id=${row.original.quoteId}`)}>
            <LinkIcon className="mr-1 h-3 w-3" />{row.original.quoteNumber}
          </Button>
        )
        : <span className="text-muted-foreground text-xs">—</span>,
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const wo = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => { setSelectedWO(wo); setIsFormOpen(true); }}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPDF(wo)}>
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Cambiar Estado</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={wo.status}
                    onValueChange={(v) => handleStatusChange(wo, v as WorkOrder["status"])}>
                    <DropdownMenuRadioItem value="Pendiente">Pendiente</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="En Proceso">En Proceso</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Completado">Completado</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="Cancelado">Cancelado</DropdownMenuRadioItem>
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
                    <AlertDialogTitle>¿Eliminar {wo.otNumber}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminará permanentemente la orden de trabajo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(wo.id)} className="bg-destructive hover:bg-destructive/90">
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
  ], [handleDelete, handleStatusChange, router]);

  const table = useReactTable({
    data: filteredWOs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    initialState: { pagination: { pageSize: 10 } },
    state: { globalFilter: filter, columnFilters, sorting },
    onGlobalFilterChange: setFilter,
  });

  if (isLoading || authIsLoading || isProfileLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Buscar por # OT o cliente..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-xs"
          />
          {/* Date filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" id="ot-date-filter"
                className={cn("w-[280px] justify-start text-left font-normal", !date && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to
                    ? <>{format(date.from, "d 'de' LLL, y", { locale: es })} – {format(date.to, "d 'de' LLL, y", { locale: es })}</>
                    : format(date.from, "d 'de' LLL, y", { locale: es })
                ) : "Filtrar por fecha..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar initialFocus mode="range" defaultMonth={date?.from} selected={date}
                onSelect={setDate} numberOfMonths={1} locale={es} />
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="capitalize" id="ot-status-filter">
                {(table.getColumn("status")?.getFilterValue() as string) ?? "Estado"}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={(table.getColumn("status")?.getFilterValue() as string | undefined) ?? "all"}
                onValueChange={(v: string) => table.getColumn("status")?.setFilterValue(v === "all" ? undefined : v)}>
                <DropdownMenuRadioItem value="all">Todos</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Pendiente">Pendiente</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="En Proceso">En Proceso</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Completado">Completado</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="Cancelado">Cancelado</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {(Boolean(filter) || Boolean(date) || Boolean(table.getColumn("status")?.getFilterValue())) && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9"
                    onClick={() => { setFilter(""); setDate(undefined); table.getColumn("status")?.setFilterValue(undefined); }}>
                    <Eraser className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Limpiar filtros</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <Button id="ot-create-btn" onClick={() => { setSelectedWO(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear OT
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No hay órdenes de trabajo. Empieza creando una o acepta una cotización.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
      </div>

      <WorkOrderForm
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave as any}
        workOrder={selectedWO}
        userRole={userProfile?.role}
      />
    </div>
  );
}
