

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Loader2, PlusCircle, MoreHorizontal, Edit, Trash2, Check, ChevronsUpDown, Download, FileSpreadsheet, ArrowUpDown, Calendar as CalendarIcon, Eraser, ChevronDown } from "lucide-react";
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
import { ColumnDef, flexRender, getCoreRowModel, useReactTable, getFilteredRowModel, getPaginationRowModel, ColumnFiltersState, SortingState, getSortedRowModel } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, runTransaction, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Badge } from "../ui/badge";
import { cn } from "@/lib/utils";
import type { Quote } from "./quote-manager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { QuoteForm } from "../forms/quote-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Client } from "./client-manager";
import * as XLSX from "xlsx";
import { User } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";


const projectSchema = z.object({
  id: z.string().optional(),
  client: z.string().min(2, { message: "El nombre del cliente es requerido." }),
  description: z.string().min(10, { message: "La descripción es requerida (mínimo 10 caracteres)." }),
  responsible: z.string().optional(),
  status: z.enum(["Nuevo", "En Progreso", "En Pausa", "Completado"]),
  programmedDate: z.string().min(1, { message: "La fecha programada es requerida." }),
  priority: z.enum(["Baja", "Media", "Alta"]),
  quoteId: z.string().optional().nullable(),
});

export type Project = z.infer<typeof projectSchema> & {
    id: string;
    userId: string;
    lastUpdated: any;
    createdAt: any;
};

type UserProfile = {
  role: 'admin' | 'employee';
  userCode: string;
  quoteCounter: number;
  purchaseOrderCounter: number;
  displayName: string;
};

const downloadQuotePDF = async (quote: Quote) => {
    const doc = new jsPDF();
    const quoteId = quote.quoteNumber;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const pageMargin = 14;
    const bottomMargin = 40; 
    const topMargin = 40;
    let lastDrawnPage = 1;

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
    
    const drawHeader = () => {
        if (logoDataUrl) {
            doc.addImage(logoDataUrl, 'PNG', pageMargin, 12, 20, 15);
        }
        
        const headerDetailsX = pageWidth - pageMargin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`COTIZACIÓN`, headerDetailsX, 20 - 2, { align: 'right' });
        
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
        doc.text(`${quoteId}`, headerDetailsX, 20 + 4, { align: 'right' });

        doc.setDrawColor(221, 221, 221); 
        doc.line(pageMargin, 30, pageWidth - pageMargin, 30);
        doc.setTextColor(0, 0, 0);
    };

    drawHeader(); 

    const localDate = new Date(quote.date.replace(/-/g, '\/'));
    
    const clientInfo = [
        `Empresa: ${quote.clientName}`,
        `Teléfono: ${quote.clientPhone}`,
        `Dirección: ${quote.clientAddress}`,
        `RFC: ${quote.rfc || 'N/A'}`,
    ].join('\n');

    const quoteInfo = [
        `Fecha: ${localDate.toLocaleDateString('es-MX', {timeZone: 'UTC'})}`,
        `Ciudad: Mérida, Yucatán`,
        `Tipo de Servicio: ${quote.tipoServicio || 'N/A'}`,
        `Tipo de Trabajo: ${quote.tipoTrabajo || 'N/A'}`,
        `Equipo/Lugar: ${quote.equipoLugar || 'N/A'}`,
    ].join('\n');
    
    const companyInfo = [
        "Calle 33 No. 259 Num int 2 por 12 y 14 Col. Santa María Chuburna CP. 97138, Mérida, Yucatán",
        "",
        "Oficinas: 990-101-0221",
        "Correo: corporativo@lebaref.com",
    ].join('\n');

    autoTable(doc, {
        startY: 35,
        head: [['DATOS DEL CLIENTE', 'DATOS DE LA COTIZACIÓN', 'CONTACTO LEBAREF']],
        body: [[clientInfo, quoteInfo, companyInfo]],
        theme: 'grid',
        headStyles: {
            fontStyle: 'bold',
            fillColor: [240, 240, 240],
            textColor: [0,0,0],
            fontSize: 8,
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
            overflow: 'linebreak',
            valign: 'top',
            textColor: [0, 0, 0],
        },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 60 },
            2: { cellWidth: 62 },
        },
        margin: { top: topMargin, left: pageMargin, right: pageMargin },
    });
    
    let finalY = (doc as any).lastAutoTable.finalY;

    autoTable(doc, {
        startY: finalY + 2,
        didDrawPage: (data) => {
            if (data.pageNumber > lastDrawnPage) {
               drawHeader();
               lastDrawnPage = data.pageNumber;
            }
        },
        head: [[
            { content: 'ARTÍCULO NO.', styles: { halign: 'center' } },
            { content: 'DESCRIPCIÓN', styles: { halign: 'left' } },
            { content: 'UNIDAD', styles: { halign: 'center' } },
            { content: 'CANTIDAD', styles: { halign: 'center' } },
            { content: 'PRECIO POR UNIDAD', styles: { halign: 'center' } },
            { content: 'TOTAL', styles: { halign: 'center' } }
        ]],
        body: quote.items.map((item, index) => [
            { content: index + 1, styles: { halign: 'center' } },
            { content: item.description, styles: { halign: 'left' } },
            { content: item.unidad || 'PZA', styles: { halign: 'center' } },
            { content: (item.quantity || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), styles: { halign: 'right' } },
            { content: `$${(item.price || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right' } },
            { content: `$${((item.quantity || 0) * (item.price || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, styles: { halign: 'right' } }
        ]),
        theme: 'grid',
        headStyles: { fillColor: [41, 71, 121], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'center' },
        bodyStyles: { fontSize: 7, overflow: 'linebreak', textColor: [0,0,0] },
        columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20 },
            3: { cellWidth: 25 },
            4: { cellWidth: 30 },
            5: { cellWidth: 30 },
        },
        margin: { top: topMargin, bottom: bottomMargin, left: pageMargin, right: pageMargin }
    });

    finalY = (doc as any).lastAutoTable.finalY;
    
    if (finalY > pageHeight - bottomMargin - 30) {
        doc.addPage();
        drawHeader();
        lastDrawnPage++;
        finalY = topMargin;
    }

    const subtotal = quote.subtotal ?? quote.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const ivaPercentage = quote.iva ?? 16;
    const ivaAmount = subtotal * (ivaPercentage / 100);
    const total = quote.total ?? subtotal + ivaAmount;

    autoTable(doc, {
        body: [
            ['SUBTOTAL', `$${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            [`IVA (${ivaPercentage}%)`, `$${ivaAmount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
            ['TOTAL', `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ],
        startY: finalY + 5,
        theme: 'grid',
        tableWidth: 50,
        margin: { left: pageWidth - pageMargin - 50 },
        styles: {
            fontSize: 8,
            cellPadding: 2,
        },
        columnStyles: {
            0: {
                fontStyle: 'bold',
                fillColor: [41, 71, 121], // Blue
                textColor: 255, // White
                halign: 'right',
                cellWidth: 25
            },
            1: {
                halign: 'right',
                cellWidth: 25,
                fontStyle: 'bold',
                textColor: [0, 0, 0]
            }
        },
        didParseCell: (data) => {
            if (data.row.index === 2) { // TOTAL row
                data.cell.styles.fontStyle = 'bold';
            }
        }
    });

    finalY = (doc as any).lastAutoTable.finalY;


    if (finalY + 60 > pageHeight - bottomMargin) { 
        doc.addPage();
        drawHeader();
        lastDrawnPage++;
        finalY = topMargin;
    }

    const sectionsBody: any[] = [];
    if (quote.observations) {
        sectionsBody.push([{ content: 'Comentarios y Diagnóstico:', styles: { fontStyle: 'bold', fontSize: 8 } }]);
        sectionsBody.push([{ content: quote.observations, styles: { fontSize: 7, cellPadding: {top: 1, bottom: 4} } }]);
    }
    if (quote.policies) {
        sectionsBody.push([{ content: 'Garantías:', styles: { fontStyle: 'bold', fontSize: 8 } }]);
        sectionsBody.push([{ content: quote.policies, styles: { fontSize: 6, cellPadding: {top: 1, bottom: 4} } }]);
    }
    if (quote.paymentTerms) {
        sectionsBody.push([{ content: 'Condiciones de Pago:', styles: { fontStyle: 'bold', fontSize: 8 } }]);
        sectionsBody.push([{ content: quote.paymentTerms, styles: { fontSize: 7, cellPadding: {top: 1, bottom: 4} } }]);
    }

    if (sectionsBody.length > 0) {
        autoTable(doc, {
            startY: finalY + 2,
            body: sectionsBody,
            theme: 'plain',
            styles: { overflow: 'linebreak', textColor: [0,0,0] },
            margin: { top: topMargin, left: pageMargin, right: pageMargin, bottom: bottomMargin },
            didDrawPage: (data) => {
                if(data.pageNumber > lastDrawnPage) {
                    drawHeader();
                    lastDrawnPage = data.pageNumber;
                }
            },
        });
        finalY = (doc as any).lastAutoTable.finalY;
    }
    
    const signatureBlockHeight = 25;
    const footerHeight = 20;

    if (finalY + signatureBlockHeight > pageHeight - footerHeight) {
        doc.addPage();
        drawHeader();
        finalY = topMargin;
    }

    const signatureY = finalY + 15;
    doc.setDrawColor(150, 150, 150);
    doc.line(70, signatureY, 140, signatureY);
    doc.setFontSize(9).setFont(undefined, 'normal').setTextColor(0);
    doc.text("FIRMA DE ACEPTACIÓN", 105, signatureY + 5, { align: 'center' });
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7).setTextColor(0);
        doc.text("Gracias por su preferencia.", pageMargin, pageHeight - 15);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - pageMargin, pageHeight - 15, { align: 'right' });
    }
    
    doc.save(`${quoteId}.pdf`);
}

const downloadQuoteExcel = (quote: Quote) => {
    const quoteId = quote.quoteNumber;
    
    const itemsHeader = ["Descripción", "Unidad", "Cantidad", "Precio Unitario", "Importe"];
    const itemsData = quote.items.map(item => [
      item.description,
      item.unidad || 'PZA',
      item.quantity,
      item.price,
      (item.quantity || 0) * (item.price || 0)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([itemsHeader]);
    XLSX.utils.sheet_add_json(ws, itemsData, {origin: -1, skipHeader: true});

    const subtotal = quote.subtotal ?? quote.items.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
    const ivaPercentage = quote.iva ?? 16;
    const ivaAmount = subtotal * (ivaPercentage / 100);
    const total = quote.total ?? subtotal + ivaAmount;

    const totalsData = [
        [], 
        ["", "", "", "Subtotal", subtotal],
        ["", "", "", `IVA (${ivaPercentage}%)`, ivaAmount],
        ["", "", "", "Total", total],
    ];

    XLSX.utils.sheet_add_aoa(ws, totalsData, {origin: -1});

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cotizacion");
    XLSX.writeFile(wb, `${quoteId}.xlsx`);
};

export function ProjectManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  const [isQuoteFormOpen, setIsQuoteFormOpen] = useState(false);
  const [linkingProject, setLinkingProject] = useState<Project | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  
  const highlightId = searchParams.get('highlight');
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    rowRefs.current = {};
  }, [projects]);


  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsLoading(false);
      setIsProfileLoading(false);
      setProjects([]);
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
    const baseProjectsQuery = collection(db, "projects");
    const projectsQuery = is_admin
        ? query(baseProjectsQuery)
        : query(baseProjectsQuery, where("userId", "==", user.uid));

    const unsubscribeProjects = onSnapshot(projectsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(data);
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'projects', operation: 'list' }));
        toast({ title: "Error de Permisos", description: "No se pudieron cargar los proyectos.", variant: "destructive" });
        setIsLoading(false);
    });

    const quotesQuery = collection(db, "quotes");
    const unsubscribeQuotes = onSnapshot(quotesQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
        setQuotes(data);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'quotes',
            operation: 'list',
        }));
    });
    

    return () => {
        unsubscribeProjects();
        unsubscribeQuotes();
    };
  }, [user, userProfile, isProfileLoading, toast]);
  
  const filteredProjects = useMemo(() => {
    if (!date?.from) return projects;
    
    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = date.to ? new Date(date.to) : new Date(date.from);
    toDate.setHours(23, 59, 59, 999);

    return projects.filter(project => {
        if (!project.programmedDate) return false;
        const projectDate = new Date(project.programmedDate.replace(/-/g, '\/'));
        return projectDate >= fromDate && projectDate <= toDate;
    });
  }, [projects, date]);
  
  const handleSaveProject = useCallback(async (data: Omit<Project, 'id' | 'lastUpdated' | 'createdAt' | 'userId'>) => {
    if (!user || !userProfile) return;
    
    const finalData = {
        ...data,
        responsible: data.responsible?.trim() || userProfile.displayName || user.displayName || 'Usuario sin nombre',
    };

    try {
        if (selectedProject?.id) {
            const projectDoc = doc(db, "projects", selectedProject.id);
            await updateDoc(projectDoc, { ...finalData, lastUpdated: serverTimestamp() });
            toast({ title: "Proyecto Actualizado", description: "El proyecto ha sido actualizado." });
        } else {
            const projectData = { ...finalData, lastUpdated: serverTimestamp(), createdAt: serverTimestamp(), userId: user.uid };
            await addDoc(collection(db, "projects"), projectData);
            toast({ title: "Proyecto Creado", description: "Un nuevo proyecto ha sido creado." });
        }
        setIsFormOpen(false);
        setSelectedProject(null);
    } catch(error) {
        console.error("Error saving project:", error);
        toast({ title: "Error al guardar", variant: "destructive" });
    }
  }, [selectedProject, toast, user, userProfile]);

  const handleDeleteProject = useCallback(async (id: string) => {
      try {
        await deleteDoc(doc(db, "projects", id));
        toast({ title: "Proyecto Eliminado", variant: "destructive" });
      } catch(error) {
         console.error("Error deleting project:", error);
         toast({ title: "Error al eliminar", variant: "destructive" });
      }
  }, [toast]);

   const handleStatusChange = useCallback(async (projectId: string, newStatus: Project['status']) => {
    const projectDoc = doc(db, "projects", projectId);
    try {
        await updateDoc(projectDoc, { status: newStatus });
        toast({ title: "Estado Actualizado", description: `El estado del proyecto ahora es ${newStatus}.` });
    } catch(error) {
        console.error("Error updating status:", error);
        toast({ title: "Error al actualizar", variant: "destructive" });
    }
  }, [toast]);

  const handleLinkQuote = useCallback(async (projectId: string, quoteId: string | null) => {
      const projectDoc = doc(db, "projects", projectId);
      try {
        await updateDoc(projectDoc, { quoteId: quoteId });
        toast({ title: "Proyecto Actualizado", description: "La cotización ha sido vinculada/desvinculada." });
      } catch(error) {
         console.error("Error linking quote:", error);
         toast({ title: "Error al vincular", variant: "destructive" });
      }
  }, [toast]);

  const handleSaveAndLinkQuote = useCallback(async (quoteData: any) => {
    if (!linkingProject || !user) return;
    try {
        const newQuoteId = await runTransaction(db, async (transaction) => {
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("User profile not found");
            
            const userData = userDoc.data();
            const newCounter = (userData.quoteCounter || 0) + 1;
            const userCode = userData.userCode || '00';
            const newQuoteNumber = `C${userCode}-${String(newCounter).padStart(4, '0')}`;

            transaction.update(userDocRef, { quoteCounter: newCounter });

            const newQuoteRef = doc(collection(db, "quotes"));
            transaction.set(newQuoteRef, { ...quoteData, quoteNumber: newQuoteNumber, userId: user.uid });
            return newQuoteRef.id;
        });

        const projectDoc = doc(db, "projects", linkingProject.id);
        await updateDoc(projectDoc, { quoteId: newQuoteId });

        toast({ title: "Cotización Creada y Vinculada", description: "La nueva cotización se ha vinculado al proyecto." });

    } catch (error) {
        console.error("Error creating and linking quote:", error);
        toast({ title: "Error al vincular", description: "No se pudo crear y vincular la cotización.", variant: "destructive" });
    } finally {
        setIsQuoteFormOpen(false);
        setLinkingProject(null);
    }
  }, [linkingProject, toast, user]);

    const handleUpdateQuote = useCallback(async (quoteData: any) => {
        if (!editingQuote) return;
        try {
            const quoteRef = doc(db, "quotes", editingQuote.id);
            await updateDoc(quoteRef, quoteData);
            toast({ title: "Cotización Actualizada", description: `La cotización para ${quoteData.clientName} ha sido actualizada.` });
        } catch (error) {
            console.error("Error updating quote:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `quotes/${editingQuote.id}`,
                operation: 'update',
                requestResourceData: quoteData
            }));
            toast({ title: "Error al actualizar", description: "No se pudo actualizar la cotización.", variant: "destructive" });
        } finally {
            setIsQuoteFormOpen(false);
            setEditingQuote(null);
        }
    }, [editingQuote, toast]);

    const handleEditQuote = useCallback((quote: Quote) => {
        setEditingQuote(quote);
        setIsQuoteFormOpen(true);
    }, []);
  
    const getColumns = useCallback(
    (
        { handleDeleteProject, handleStatusChange, quotes, projects, handleLinkQuote, handleEditQuote, user, userProfile, setLinkingProject, setIsQuoteFormOpen, setSelectedProject, setIsFormOpen }: any
    ): ColumnDef<Project>[] => [
      { 
        accessorKey: "client", 
        header: ({ column }) => (
            <Button variant="ghost" className="p-0 justify-start" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Cliente <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ), 
      },
      { accessorKey: "description", header: "Descripción", cell: ({row}) => <div className="max-w-xs whitespace-normal">{row.original.description}</div> },
      { accessorKey: "responsible", header: "Responsable", cell: ({row}) => {
          const name = row.original.responsible;
          const initials = name?.split(' ').map(n => n[0]).join('').substring(0, 2) || '';
          return (
            <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 text-xs">
                    <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
                <span>{name}</span>
            </div>
          )
      } },
       { 
        id: "quote",
        header: "Cotización",
        cell: ({ row }) => {
            const project = row.original;
            const currentQuote = quotes.find(q => q.id === project.quoteId);
            const [open, setOpen] = useState(false);
            
            const otherLinkedQuoteIds = new Set(
              projects.filter(p => p.id !== project.id).map(p => p.quoteId).filter(Boolean)
            );
            
            const availableQuotes = quotes.filter(q => {
                if (otherLinkedQuoteIds.has(q.id)) return false; 
                if (userProfile?.role === 'admin') return true; 
                return q.userId === user?.uid; 
            });

            const onSelectQuote = (quoteId: string | null) => {
              handleLinkQuote(project.id, quoteId);
              setOpen(false);
            }

            return (
              <div className="flex items-center gap-1 whitespace-nowrap">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-[150px] justify-between">
                      {currentQuote 
                          ? currentQuote.quoteNumber
                          : "Asignar..."
                      }
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar por cliente o ID..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron cotizaciones.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem key="ninguna" value="ninguna" onSelect={() => onSelectQuote(null)}>
                            <Check className={cn("mr-2 h-4 w-4", !project.quoteId ? "opacity-100" : "opacity-0")}/>
                            Ninguna
                          </CommandItem>
                          {availableQuotes.map(q => (
                            <CommandItem 
                              key={q.id} 
                              value={`${q.quoteNumber} ${q.clientName}`}
                              onSelect={() => onSelectQuote(q.id)}
                            >
                              <Check className={cn("mr-2 h-4 w-4", project.quoteId === q.id ? "opacity-100" : "opacity-0")}/>
                              {q.quoteNumber} ({q.clientName})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandSeparator />
                          <CommandGroup>
                              <CommandItem onSelect={() => { setOpen(false); setLinkingProject(project); setIsQuoteFormOpen(true); }}>
                                  <PlusCircle className="mr-2 h-4 w-4" />
                                  Crear y Vincular Cotización
                              </CommandItem>
                          </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                 {currentQuote && (
                    <div className="flex items-center flex-nowrap">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditQuote(currentQuote)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => await downloadQuotePDF(currentQuote)}>
                            <Download className="h-4 w-4" />
                        </Button>
                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadQuoteExcel(currentQuote)}>
                            <FileSpreadsheet className="h-4 w-4" />
                        </Button>
                    </div>
                )}
              </div>
            )
        }
      },
      { accessorKey: "status", header: "Estado", cell: ({row}) => {
         const project = row.original;
         const status = project.status;
         return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="p-0 h-auto">
                        <Badge variant="outline" className={cn('cursor-pointer capitalize', {
                           'text-blue-600 border-blue-600': status === 'Nuevo',
                           'text-yellow-600 border-yellow-600': status === 'En Progreso',
                           'text-red-600 border-red-600': status === 'En Pausa',
                           'text-green-600 border-green-600': status === 'Completado',
                        })}>{status}</Badge>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                     <DropdownMenuRadioGroup value={project.status} onValueChange={(newStatus) => handleStatusChange(project.id, newStatus as Project['status'])}>
                        <DropdownMenuRadioItem value="Nuevo">Nuevo</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="En Progreso">En Progreso</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="En Pausa">En Pausa</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="Completado">Completado</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
         )
      }},
      { 
        accessorKey: "programmedDate", 
        header: ({ column }) => (
            <Button variant="ghost" className="p-0 justify-start" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Fecha Prog. <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({row}) => {
            if (!row.original.programmedDate) return 'N/A';
            const localDate = new Date(row.original.programmedDate.replace(/-/g, '\/'));
            return localDate.toLocaleDateString('es-MX', {timeZone: 'UTC'});
        } 
      },
      { accessorKey: "priority", header: "Prioridad", cell: ({row}) => {
         const priority = row.original.priority;
         return <Badge variant="outline" className={cn('capitalize', {
            'text-red-600 border-red-600': priority === 'Alta',
            'text-yellow-600 border-yellow-600': priority === 'Media',
            'text-green-600 border-green-600': priority === 'Baja',
         })}>{priority}</Badge>
      }},
      { 
        accessorKey: "createdAt", 
        header: ({ column }) => (
            <Button variant="ghost" className="p-0 justify-start" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Creado <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({row}) => {
            if (!row.original.createdAt) return 'N/A';
            const localDate = new Date(row.original.createdAt.toDate());
            return localDate.toLocaleDateString('es-MX');
        } 
      },
      { id: "actions",
        cell: ({ row }) => {
            const project = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => { setSelectedProject(project); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Editar</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-500"><Trash2 className="mr-2 h-4 w-4"/> Eliminar</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción eliminará el proyecto permanentemente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
      }
], []);

  const columns = useMemo(() => getColumns({
        handleDeleteProject, 
        handleStatusChange, 
        quotes, 
        projects, 
        handleLinkQuote,
        handleEditQuote,
        user, 
        userProfile,
        setLinkingProject,
        setIsQuoteFormOpen,
        setSelectedProject,
        setIsFormOpen,
    }), [ projects, quotes, user, userProfile, handleDeleteProject, handleStatusChange, handleLinkQuote, handleEditQuote, setIsFormOpen, setSelectedProject, getColumns]);

  const table = useReactTable({ 
    data: filteredProjects, 
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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

  useEffect(() => {
    if (highlightId && table.getRowModel().rows.length > 0) {
      const targetRow = rowRefs.current[highlightId];
      if (targetRow) {
        setTimeout(() => {
          targetRow.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }, 100);
      }
    }
  }, [highlightId, projects, table]);

  const quoteForForm = useMemo(() => 
    editingQuote || (linkingProject ? { clientName: linkingProject.client } : null)
  , [editingQuote, linkingProject]);

  const role = userProfile?.role;
  
  const linkedQuoteIds = useMemo(() => new Set(projects.map(p => p.quoteId).filter(Boolean)), [projects]);

  if (isLoading || authIsLoading || isProfileLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
                <Input placeholder="Buscar por cliente o descripción..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm"/>
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
                                "Filtrar por fecha programada..."
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
                          <DropdownMenuRadioItem value="Nuevo">Nuevo</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="En Progreso">En Progreso</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="En Pausa">En Pausa</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="Completado">Completado</DropdownMenuRadioItem>
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
            <Button onClick={() => { setSelectedProject(null); setIsFormOpen(true);}}><PlusCircle className="mr-2 h-4 w-4" /> Crear Proyecto</Button>
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>{table.getHeaderGroups().map(headerGroup => (<TableRow key={headerGroup.id}>{headerGroup.headers.map(header => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>))}</TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (table.getRowModel().rows.map(row => (<TableRow key={row.id} ref={el => (rowRefs.current[row.original.id] = el)} className={cn({'highlight': row.original.id === highlightId})}>{row.getVisibleCells().map(cell => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">No hay proyectos. Empieza creando uno.</TableCell></TableRow>)}
                </TableBody>
            </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
        </div>

      <ProjectFormDialog 
        isOpen={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSave={handleSaveProject} 
        project={selectedProject} 
        quotes={quotes}
        user={user}
        userProfile={userProfile}
        linkedQuoteIds={linkedQuoteIds}
      />
      <QuoteForm 
        isOpen={isQuoteFormOpen}
        onOpenChange={(open) => {
            if (!open) {
                setLinkingProject(null);
                setEditingQuote(null);
            }
            setIsQuoteFormOpen(open);
        }}
        onSave={editingQuote ? handleUpdateQuote : handleSaveAndLinkQuote as any}
        quote={quoteForForm}
        userRole={role}
      />
    </div>
  );
}



interface ProjectFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<Project, 'id' | 'lastUpdated' | 'createdAt' | 'userId'>) => void;
  project: Project | null;
  quotes: Quote[];
  user: User | null;
  userProfile: UserProfile | null;
  linkedQuoteIds: Set<string>;
}

function ProjectFormDialog({ isOpen, onOpenChange, onSave, project, quotes, user, userProfile, linkedQuoteIds }: ProjectFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [isClientComboboxOpen, setIsClientComboboxOpen] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const qClients = collection(db, "clients");
        const unsubscribeClients = onSnapshot(qClients, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        }, (error) => {
            console.error("Could not load clients for project form: ", error);
        });
        return () => unsubscribeClients();
    }, [isOpen]);

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const form = useForm<z.infer<typeof projectSchema>>({
        resolver: zodResolver(projectSchema),
        defaultValues: { client: "", description: "", responsible: "", status: "Nuevo", programmedDate: formatDate(new Date()), priority: "Media", quoteId: null }
    });

    useEffect(() => {
        if (isOpen) {
          if (project) {
            form.reset({ 
                ...project, 
                programmedDate: project.programmedDate,
                quoteId: project.quoteId || null,
            });
          } else {
            form.reset({ client: "", description: "", responsible: "", status: "Nuevo", programmedDate: formatDate(new Date()), priority: "Media", quoteId: null });
          }
        }
      }, [project, isOpen, form]);

    const handleSubmit = async (data: z.infer<typeof projectSchema>) => {
        setIsSubmitting(true);
        const { id, ...saveData } = data;
        await onSave(saveData as any);
        setIsSubmitting(false);
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{project ? 'Editar Proyecto' : 'Crear Nuevo Proyecto'}</DialogTitle>
                    <DialogDescription>Completa los detalles del proyecto.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-2">
                         <FormField
                            control={form.control}
                            name="client"
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
                                                "w-full justify-between",
                                                !field.value && "text-muted-foreground"
                                            )}
                                            >
                                            {field.value || "Seleccionar o escribir un cliente"}
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
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea placeholder="Describe el proyecto en detalle..." {...field} /></FormControl><FormMessage /></FormItem> )} />
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FormField control={form.control} name="responsible" render={({ field }) => ( <FormItem><FormLabel>Responsable (Opcional)</FormLabel><FormControl><Input placeholder="Se asignará a usted si está vacío" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="programmedDate" render={({ field }) => ( <FormItem><FormLabel>Fecha Programada</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <FormField control={form.control} name="status" render={({ field }) => (
                            <FormItem><FormLabel>Estado</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Nuevo">Nuevo</SelectItem><SelectItem value="En Progreso">En Progreso</SelectItem><SelectItem value="En Pausa">En Pausa</SelectItem><SelectItem value="Completado">Completado</SelectItem></SelectContent>
                            </Select><FormMessage /></FormItem>
                           )} />
                           <FormField control={form.control} name="priority" render={({ field }) => (
                            <FormItem><FormLabel>Prioridad</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                <SelectContent><SelectItem value="Baja">Baja</SelectItem><SelectItem value="Media">Media</SelectItem><SelectItem value="Alta">Alta</SelectItem></SelectContent>
                            </Select><FormMessage /></FormItem>
                           )} />
                        </div>
                        <FormField control={form.control} name="quoteId" render={({ field }) => (
                            <FormItem><FormLabel>Cotización Vinculada</FormLabel>
                            <Select onValueChange={(value) => field.onChange(value === 'none' ? null : value)} value={field.value ?? "none"}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar cotización..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">Ninguna</SelectItem>
                                    {quotes.filter(q => {
                                        const isLinked = linkedQuoteIds.has(q.id);
                                        const isSelfLinked = project?.quoteId === q.id;
                                        if (isLinked && !isSelfLinked) return false;
                                        if (userProfile?.role === 'admin') return true;
                                        return q.userId === user?.uid;
                                    }).map(q => (
                                        <SelectItem key={q.id} value={q.id}>
                                           {q.quoteNumber} ({q.clientName})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage /></FormItem>
                        )} />
                         <DialogFooter className="sticky bottom-0 bg-background pt-4">
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {project ? 'Guardar Cambios' : 'Crear Proyecto'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

    


