

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
import { QuoteForm } from "@/components/forms/quote-form";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, runTransaction, getDoc, writeBatch, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Badge } from "../ui/badge";
import { LOGO_BASE64 } from "@/lib/logo-base64";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import * as XLSX from "xlsx";
import { DateRange } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export type QuoteItem = {
  description: string;
  quantity: number;
  price: number;
  unidad?: string;
};

export type QuoteHistoryEntry = {
  updatedAt: string;
  userId: string;
  userName: string;
  snapshot: {
    clientName: string;
    clientPhone: string;
    clientEmail?: string;
    clientAddress: string;
    serviceAddress?: string;
    responsable?: string;
    hideClientPhone?: boolean;
    date: string;
    expirationDate?: string;
    rfc?: string;
    observations?: string;
    policies?: string;
    paymentTerms?: string;
    subtotal: number;
    total: number;
    iva?: number;
    status: Quote['status'];
    items: QuoteItem[];
    tipoServicio?: string;
    tipoTrabajo?: string;
    equipoLugar?: string;
  };
};

export type Quote = {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
  serviceAddress?: string;
  responsable?: string;
  hideClientPhone?: boolean;
  date: string;
  expirationDate?: string;
  rfc?: string;
  observations?: string;
  policies?: string;
  paymentTerms?: string;
  subtotal: number;
  total: number;
  iva?: number;
  status: "Borrador" | "Enviada" | "Aceptada" | "Rechazada" | "Pagada";
  items: QuoteItem[];
  linkedTicketId?: string;
  tipoServicio?: string;
  tipoTrabajo?: string;
  equipoLugar?: string;
  userId: string;
  history?: QuoteHistoryEntry[];
  acceptedDate?: string;
};

type UserProfile = {
  role: 'admin' | 'employee';
  userCode: string;
  quoteCounter: number;
};

const createOrUpdateTicketFromQuote = async (quote: Quote, currentUserId: string) => {
    if (!quote.items || quote.items.length === 0) {
      throw new Error("La cotización no tiene items.");
    }
    
    const itemsDescription = quote.items.map(item => `${item.quantity} x ${item.description}`).join(', ');
    const responsableDetails = quote.responsable ? ` --- RESPONSABLE: ${quote.responsable}` : '';
    const finalDescription = `Servicio basado en la cotización #${quote.quoteNumber}.${responsableDetails} --- ITEMS: ${itemsDescription}. --- OBSERVACIONES: ${quote.observations || 'Ninguna.'}`;

    const ticketData = {
      clientName: quote.clientName,
      clientPhone: quote.clientPhone, 
      clientAddress: quote.serviceAddress || quote.clientAddress,
      clientEmail: quote.clientEmail || "N/A", 
      clientRfc: quote.rfc || "N/A",
      serviceType: "correctivo" as "correctivo" | "preventivo", 
      equipmentType: `Servicio desde cotización #${quote.quoteNumber}`,
      description: finalDescription,
      urgency: "media" as "baja" | "media" | "alta",
      status: "Recibido",
      createdAt: serverTimestamp(),
      price: quote.total,
      userId: currentUserId,
      quoteId: quote.id,
    };
  
    const quoteRef = doc(db, "quotes", quote.id);

    if (quote.linkedTicketId) {
        const ticketRef = doc(db, "tickets", quote.linkedTicketId);
        const batch = writeBatch(db);
        batch.update(ticketRef, ticketData);
        batch.update(quoteRef, { status: "Aceptada", acceptedDate: new Date().toISOString().split('T')[0] });
        await batch.commit();
        return quote.linkedTicketId;
    } else {
        return await runTransaction(db, async (transaction) => {
            const counterRef = doc(db, "counters", "tickets");
            const counterDoc = await transaction.get(counterRef);
            let newTicketNumber = 1;
            if (counterDoc.exists()) {
                newTicketNumber = counterDoc.data().lastNumber + 1;
            }
            transaction.set(counterRef, { lastNumber: newTicketNumber }, { merge: true });

            const newTicketRef = doc(collection(db, "tickets"));
            transaction.set(newTicketRef, { ...ticketData, ticketNumber: newTicketNumber });
            
            transaction.update(quoteRef, { 
                linkedTicketId: newTicketRef.id, 
                status: 'Aceptada',
                acceptedDate: new Date().toISOString().split('T')[0]
            });

            return newTicketRef.id;
        });
    }
};

const downloadPDF = async (quote: Quote) => {
    const doc = new jsPDF();
    const quoteId = quote.quoteNumber;
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const pageMargin = 14;
    const bottomMargin = 40; 
    const topMargin = 40;
    let lastDrawnPage = 1;

    const drawHeader = () => {
        doc.addImage(LOGO_BASE64, 'PNG', pageMargin, 5, 45, 25.3);
        
        const headerDetailsX = pageWidth - pageMargin;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`COTIZACIÓN`, headerDetailsX, 20 - 2, { align: 'right' });
        
        doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(0, 0, 0);
        doc.text(`${quoteId}`, headerDetailsX, 20 + 4, { align: 'right' });

        doc.setDrawColor(221, 221, 221); 
        doc.line(pageMargin, 32, pageWidth - pageMargin, 32);
        doc.setTextColor(0, 0, 0);
    };

    drawHeader(); 

    const localDate = new Date(quote.date.replace(/-/g, '\/'));
    
    const clientInfo = [
        `Empresa: ${quote.clientName}`,
        !quote.hideClientPhone ? `Teléfono: ${quote.clientPhone}` : null,
        `Dirección: ${quote.clientAddress}`,
        `RFC: ${quote.rfc || 'N/A'}`,
    ].filter(Boolean).join('\n');

    const quoteInfo = [
        `Fecha: ${localDate.toLocaleDateString('es-MX', {timeZone: 'UTC'})}`,
        `Ciudad: Mérida, Yucatán`,
        `Tipo de Servicio: ${quote.tipoServicio || 'N/A'}`,
        `Tipo de Trabajo: ${quote.tipoTrabajo || 'N/A'}`,
        `Equipo/Lugar: ${quote.equipoLugar || 'N/A'}`,
        quote.serviceAddress ? `Lugar de Ejecución: ${quote.serviceAddress}` : null,
    ].filter(Boolean).join('\n');
    
    const companyInfo = [
        "Calle 33 No. 259 Num int 2 por 12 y 14 Col. Santa María Chuburna CP. 97138, Mérida, Yucatán",
        "",
        "Oficinas: 990 101 0387",
        "Correo: corporativo@lebaref.com",
        quote.responsable ? `Responsable: ${quote.responsable}` : null,
    ].filter(val => val !== null).join('\n');

    autoTable(doc, {
        startY: 37,
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
};

const downloadExcel = (quote: Quote) => {
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

export function QuoteManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    if (highlightId && quotes.length > 0) {
      const quote = quotes.find(q => q.id === highlightId);
      if (quote) {
        setSelectedQuote(quote);
        setIsFormOpen(true);
        // Clean URL params so it doesn't pop up again
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [highlightId, quotes]);

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsProfileLoading(false);
      setIsLoading(false);
      setQuotes([]);
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
    const baseQuotesQuery = collection(db, "quotes");
    const q = is_admin ? query(baseQuotesQuery) : query(baseQuotesQuery, where("userId", "==", user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const quotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
        setQuotes(quotesData);
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: 'quotes',
            operation: 'list',
        }));
        setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user, userProfile, isProfileLoading, toast]);
  
  const filteredQuotes = useMemo(() => {
    if (!date?.from) return quotes;
    
    const fromDate = new Date(date.from);
    fromDate.setHours(0, 0, 0, 0);

    const toDate = date.to ? new Date(date.to) : new Date(date.from);
    toDate.setHours(23, 59, 59, 999);

    return quotes.filter(quote => {
        if (!quote.date) return false;
        const quoteDate = new Date(quote.date.replace(/-/g, '\/'));
        return quoteDate >= fromDate && quoteDate <= toDate;
    });
  }, [quotes, date]);


  const handleSave = useCallback(async (quoteData: Omit<Quote, 'id' | 'quoteNumber' | 'userId' | 'history'>) => {
    if (!user) return;
    try {
        if (selectedQuote) { 
            const wasAccepted = selectedQuote.status === 'Aceptada';
            const isNowAccepted = quoteData.status === 'Aceptada';
            
            const historyEntry: QuoteHistoryEntry = {
              updatedAt: new Date().toISOString(),
              userId: user.uid,
              userName: user.displayName || user.email || "Usuario",
              snapshot: {
                clientName: selectedQuote.clientName || "",
                clientPhone: selectedQuote.clientPhone || "",
                clientEmail: selectedQuote.clientEmail || "",
                clientAddress: selectedQuote.clientAddress || "",
                serviceAddress: selectedQuote.serviceAddress || "",
                responsable: selectedQuote.responsable || "",
                hideClientPhone: selectedQuote.hideClientPhone || false,
                date: selectedQuote.date || "",
                expirationDate: selectedQuote.expirationDate || "",
                rfc: selectedQuote.rfc || "",
                observations: selectedQuote.observations || "",
                policies: selectedQuote.policies || "",
                paymentTerms: selectedQuote.paymentTerms || "",
                subtotal: selectedQuote.subtotal || 0,
                total: selectedQuote.total || 0,
                iva: selectedQuote.iva ?? 16,
                status: selectedQuote.status || "Borrador",
                items: selectedQuote.items || [],
                tipoServicio: selectedQuote.tipoServicio || "",
                tipoTrabajo: selectedQuote.tipoTrabajo || "",
                equipoLugar: selectedQuote.equipoLugar || "",
              }
            };
            const currentHistory = selectedQuote.history || [];
            const newHistory = [...currentHistory, historyEntry];
            
            if (isNowAccepted && !wasAccepted) {
                await createOrUpdateTicketFromQuote({ ...selectedQuote, ...quoteData, history: newHistory }, user.uid);
                toast({ title: "Cotización Aceptada", description: `Se ha creado o actualizado la orden de servicio.` });
            } else {
                const quoteRef = doc(db, "quotes", selectedQuote.id);
                await updateDoc(quoteRef, { ...quoteData, history: newHistory });
                toast({ title: "Cotización Actualizada", description: `La cotización para ${quoteData.clientName} ha sido actualizada.` });
            }
        } else { 
            await runTransaction(db, async (transaction) => {
                if (!user) throw new Error("User not authenticated");
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await transaction.get(userDocRef);
            
                if (!userDoc.exists()) {
                    throw new Error("User profile does not exist.");
                }
            
                const userData = userDoc.data();
                const newQuoteCounter = (userData.quoteCounter || 0) + 1;
                const userCode = userData.userCode || "00";
            
                const newQuoteNumber = `C${userCode}-${String(newQuoteCounter).padStart(4, '0')}`;
            
                transaction.update(userDocRef, { quoteCounter: newQuoteCounter });
            
                const newQuoteRef = doc(collection(db, "quotes"));
                transaction.set(newQuoteRef, { ...quoteData, quoteNumber: newQuoteNumber, userId: user.uid });
            });
            toast({ title: "Cotización Creada", description: `Una nueva cotización ha sido creada.` });
        }
        setIsFormOpen(false);
        setSelectedQuote(null);
    } catch (error) {
        const operation = selectedQuote ? 'update' : 'create';
        const path = selectedQuote ? `quotes/${selectedQuote.id}` : 'users';
        const data = selectedQuote ? quoteData : { ...quoteData, userId: user.uid };

        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: path,
            operation: operation === 'create' ? 'write' : 'update',
            requestResourceData: data,
        }));
    }
  }, [selectedQuote, user, toast, setIsFormOpen, setSelectedQuote]);
  
  const handleDelete = useCallback(async (id: string) => {
    const docRef = doc(db, "quotes", id);
    try {
        await deleteDoc(docRef);
        toast({ title: "Cotización Eliminada", description: `La cotización ha sido eliminada.` });
    } catch (error) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete'
        }));
    }
  }, [toast]);

  const handleStatusChange = useCallback(async (quote: Quote, newStatus: Quote['status']) => {
    if (!user) {
        toast({ title: "No autenticado", description: "Debes iniciar sesión para realizar esta acción.", variant: "destructive" });
        return;
    }
    const quoteRef = doc(db, "quotes", quote.id);
    const payload = { status: newStatus };
    try {
        if (newStatus === "Aceptada") {
            await createOrUpdateTicketFromQuote(quote, user.uid);
            toast({ title: "¡Cotización Aceptada!", description: `Se ha generado/actualizado el ticket de servicio.` });
        } else {
            await updateDoc(quoteRef, payload);
            toast({ title: "Estado Actualizado", description: `La cotización para ${quote.clientName} ahora está ${newStatus}.` });
        }
    } catch (error) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: quoteRef.path,
            operation: 'update',
            requestResourceData: payload,
        }));
    }
  }, [toast, user]);

  const columns: ColumnDef<Quote>[] = useMemo(
    () => [
      { 
        accessorKey: "quoteNumber", 
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                ID <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
          return row.original.quoteNumber || 'N/A';
        }
      },
      { accessorKey: "clientName", header: "Cliente" },
      { 
        accessorKey: "date", 
        header: ({ column }) => (
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                Fecha <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        ),
        cell: ({ row }) => {
            if (!row.original.date) return 'N/A';
            const localDate = new Date(row.original.date.replace(/-/g, '\/'));
            return localDate.toLocaleDateString('es-MX', {timeZone: 'UTC'});
        } 
      },
      {
        accessorKey: "total",
        header: "Total",
        cell: ({ row }) => {
            const total = row.original.total ?? (row.original.items.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 + (row.original.iva ?? 16)/100));
            return `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        },
      },
      { accessorKey: "status", header: "Estado", cell: ({row}) => <Badge>{row.original.status}</Badge> },
      {
        id: "actions",
        cell: ({ row }) => {
           const quote = row.original;
           return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => { setSelectedQuote(quote); setIsFormOpen(true); }}>
                  <Edit className="mr-2 h-4 w-4" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => await downloadPDF(quote)}>
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadExcel(quote)}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Descargar Excel
                </DropdownMenuItem>
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Cambiar Estado</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup 
                            value={quote.status} 
                            onValueChange={(newStatus) => handleStatusChange(quote, newStatus as Quote['status'])}
                         >
                             <DropdownMenuRadioItem value="Borrador">Borrador</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Enviada">Enviada</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Aceptada">Aceptada</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Pagada">Pagada</DropdownMenuRadioItem>
                             <DropdownMenuRadioItem value="Rechazada">Rechazada</DropdownMenuRadioItem>
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
                        Esta acción no se puede deshacer. Esto eliminará permanentemente la cotización.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(quote.id)} className="bg-destructive hover:bg-destructive/90">
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
    [handleDelete, handleStatusChange]
  );

  const table = useReactTable({
    data: filteredQuotes,
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
      columnFilters,
      sorting,
    },
    onGlobalFilterChange: setFilter,
  });

  const role = userProfile?.role;

  if (isLoading || authIsLoading || isProfileLoading) {
    return <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar por ID o cliente..."
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
                            "Filtrar por fecha..."
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
                      <DropdownMenuRadioItem value="Aceptada">Aceptada</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Pagada">Pagada</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="Rechazada">Rechazada</DropdownMenuRadioItem>
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
        <Button onClick={() => { setSelectedQuote(null); setIsFormOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Cotización
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
                        No hay cotizaciones. Empieza creando una.
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
      <QuoteForm 
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSave as any}
        quote={selectedQuote}
        userRole={role}
      />
    </div>
  );
}

    
