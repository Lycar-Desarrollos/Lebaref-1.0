"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { 
  Loader2, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Download, 
  ChevronsUpDown, 
  Check, 
  Eraser, 
  ExternalLink,
  CreditCard,
  Calendar as CalendarIcon,
  ChevronDown,
  Eye,
  EyeOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

import type { Quote } from "@/components/admin/quote-manager";
import type { Client } from "@/components/admin/client-manager";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type UserProfile = {
  role: "admin" | "employee";
  permissions?: { [key: string]: boolean };
};

export default function CuentasPorCobrarPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("Todos");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>("Todos");
  const [responsableFilter, setResponsableFilter] = useState<string>("Todos");
  const [date, setDate] = useState<DateRange | undefined>(undefined);
  const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showSummary, setShowSummary] = useState(false);

  // Session & Permissions check
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/");
      return;
    }
    const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setUserProfile(profile);
        if (
          profile.role !== "admin" && 
          !profile.permissions?.reports && 
          !profile.permissions?.quotes && 
          !profile.permissions?.accounts_receivable
        ) {
          router.push("/admin");
        }
      }
    });
    return () => unsub();
  }, [user, authLoading, router]);

  // Real-time data subscription
  useEffect(() => {
    if (!userProfile) return;
    setIsLoading(true);

    const unsubs: (() => void)[] = [];

    // Subscribe to quotes
    unsubs.push(
      onSnapshot(
        collection(db, "quotes"),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quote));
          setQuotes(data);
          setIsLoading(false);
        },
        () => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "quotes", operation: "list" }));
          setIsLoading(false);
        }
      )
    );

    // Subscribe to clients
    unsubs.push(
      onSnapshot(
        collection(db, "clients"),
        (snap) => {
          const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
          setClients(data);
        },
        () => {
          errorEmitter.emit("permission-error", new FirestorePermissionError({ path: "clients", operation: "list" }));
        }
      )
    );

    return () => unsubs.forEach(unsub => unsub());
  }, [userProfile]);

  // Map of client name -> client details
  const clientMap = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach(c => {
      if (c.name) {
        map.set(c.name.trim().toLowerCase(), c);
      }
    });
    return map;
  }, [clients]);

  // Expiration calculation helper based on acceptedDate or history or creation date
  const getQuoteCalculations = useMemo(() => {
    return (q: Quote) => {
      const clientKey = q.clientName?.trim().toLowerCase();
      const client = clientKey ? clientMap.get(clientKey) : undefined;
      const creditDays = (client?.diasCredito !== undefined && client?.diasCredito !== null)
        ? Number(client.diasCredito)
        : 30;

      let expirationDate: Date | null = null;
      let daysOverdue = 0;
      let paymentStatus = {
        label: "Al corriente",
        color: "text-green-600 border-green-500 bg-green-50 hover:bg-green-50",
        icon: <CheckCircle2 className="h-3 w-3" />
      };

      // Base Date calculation: Use acceptedDate first, then history lookup, then creation date fallback
      let baseDateStr = q.acceptedDate || q.date;
      if (!baseDateStr && q.history) {
        const acceptEntry = q.history.find(
          h => h.snapshot?.status === "Aceptada" || h.snapshot?.status === "Pagada"
        );
        if (acceptEntry) {
          baseDateStr = acceptEntry.updatedAt.split("T")[0];
        }
      }
      if (!baseDateStr) {
        baseDateStr = q.date || new Date().toISOString().split("T")[0];
      }

      if (baseDateStr) {
        expirationDate = new Date(baseDateStr.replace(/-/g, "/"));
        expirationDate.setDate(expirationDate.getDate() + creditDays);
        expirationDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - expirationDate.getTime();
        daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      if (q.status === "Pagada") {
        paymentStatus = {
          label: "Pagada",
          color: "text-gray-600 border-gray-400 bg-gray-50 hover:bg-gray-50",
          icon: <CheckCircle2 className="h-3 w-3" />
        };
      } else {
        if (daysOverdue > 0) {
          paymentStatus = {
            label: `Vencida (${daysOverdue} ${daysOverdue === 1 ? 'día' : 'días'})`,
            color: "text-red-600 border-red-500 bg-red-50 hover:bg-red-50",
            icon: <AlertCircle className="h-3 w-3" />
          };
        } else if (daysOverdue >= -7) {
          const daysToDue = Math.abs(daysOverdue);
          paymentStatus = {
            label: daysToDue === 0 ? "Vence hoy" : `Por vencer (${daysToDue} ${daysToDue === 1 ? 'día' : 'días'})`,
            color: "text-yellow-600 border-yellow-500 bg-yellow-50 hover:bg-yellow-50",
            icon: <Clock className="h-3 w-3" />
          };
        } else {
          paymentStatus = {
            label: "Al corriente",
            color: "text-green-600 border-green-500 bg-green-50 hover:bg-green-50",
            icon: <CheckCircle2 className="h-3 w-3" />
          };
        }
      }

      // Desglose Subtotal, IVA y Total
      const totalVal = q.total || 0;
      const ivaPercentage = q.iva ?? 16;
      const subtotalVal = q.subtotal || (totalVal / (1 + ivaPercentage / 100));
      const ivaAmountVal = totalVal - subtotalVal;

      return {
        creditDays,
        expirationDate,
        daysOverdue,
        paymentStatus,
        subtotal: subtotalVal,
        ivaAmount: ivaAmountVal,
        total: totalVal
      };
    };
  }, [clientMap]);


  // List of clients with active debts for the client selector
  const clientsWithDebts = useMemo(() => {
    const names = new Set(
      quotes
        .filter(q => q.status === "Aceptada")
        .map(q => q.clientName)
        .filter(Boolean)
    );
    return Array.from(names).sort();
  }, [quotes]);

  // List of unique service types and sales responsibles in active quotes
  const uniqueServiceTypes = useMemo(() => {
    const types = new Set(
      quotes
        .filter(q => q.status === "Aceptada" || q.status === "Pagada")
        .map(q => q.tipoServicio)
        .filter((t): t is string => !!t)
    );
    return Array.from(types).sort();
  }, [quotes]);

  const uniqueResponsables = useMemo(() => {
    const list = new Set(
      quotes
        .filter(q => q.status === "Aceptada" || q.status === "Pagada")
        .map(q => q.responsable)
        .filter((r): r is string => !!r)
    );
    return Array.from(list).sort();
  }, [quotes]);

  // Filter quotes based on search, selected client, service, responsable, date, and status
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const { daysOverdue } = getQuoteCalculations(q);

      // 1. Filter by status
      if (statusFilter === "Todos") {
        if (q.status !== "Aceptada") return false;
      } else if (statusFilter === "Al corriente") {
        if (q.status !== "Aceptada" || daysOverdue > 0 || daysOverdue >= -7) return false;
      } else if (statusFilter === "Por vencer") {
        if (q.status !== "Aceptada" || daysOverdue > 0 || daysOverdue < -7) return false;
      } else if (statusFilter === "Vencida") {
        if (q.status !== "Aceptada" || daysOverdue <= 0) return false;
      } else if (statusFilter === "Pagada") {
        if (q.status !== "Pagada") return false;
      } else if (statusFilter === "Todas") {
        if (q.status !== "Aceptada" && q.status !== "Pagada") return false;
      }

      // 2. Filter by client
      if (selectedClient && q.clientName !== selectedClient) {
        return false;
      }

      // 3. Filter by Service Type
      if (serviceTypeFilter !== "Todos" && q.tipoServicio !== serviceTypeFilter) {
        return false;
      }

      // 4. Filter by Responsable
      if (responsableFilter !== "Todos" && q.responsable !== responsableFilter) {
        return false;
      }

      // 5. Filter by Date Range (using accepted date or fallback creation date)
      if (date?.from) {
        const fromDate = new Date(date.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = date.to ? new Date(date.to) : new Date(date.from);
        toDate.setHours(23, 59, 59, 999);

        let quoteDateStr = q.acceptedDate || q.date;
        if (!quoteDateStr && q.history) {
          const acceptEntry = q.history.find(h => h.snapshot?.status === "Aceptada" || h.snapshot?.status === "Pagada");
          if (acceptEntry) quoteDateStr = acceptEntry.updatedAt.split("T")[0];
        }
        if (!quoteDateStr) quoteDateStr = q.date;

        if (quoteDateStr) {
          const quoteDate = new Date(quoteDateStr.replace(/-/g, "/"));
          if (quoteDate < fromDate || quoteDate > toDate) return false;
        } else {
          return false;
        }
      }

      // 6. Search query
      if (searchQuery) {
        const queryVal = searchQuery.toLowerCase();
        const matchNo = q.quoteNumber?.toLowerCase().includes(queryVal);
        const matchClient = q.clientName?.toLowerCase().includes(queryVal);
        if (!matchNo && !matchClient) return false;
      }

      return true;
    });
  }, [quotes, statusFilter, selectedClient, serviceTypeFilter, responsableFilter, date, searchQuery, getQuoteCalculations]);

  // Statistics (KPIs), aging, and service breakdowns based on filtered accepted (active) quotes
  const stats = useMemo(() => {
    const aceptadas = filteredQuotes.filter(q => q.status === "Aceptada");

    let totalPorCobrar = 0;
    let totalVencido = 0;
    const clientesVencidos = new Set<string>();
    let totalDiasRetraso = 0;
    let countVencidos = 0;

    let aging = {
      corriente: 0,
      r1_30: 0,
      r31_60: 0,
      r61_90: 0,
      r90_plus: 0
    };

    const serviceBreakdown = new Map<string, number>();

    aceptadas.forEach(q => {
      const { daysOverdue, total } = getQuoteCalculations(q);
      totalPorCobrar += total;

      const serviceType = q.tipoServicio || "General/Otro";
      serviceBreakdown.set(serviceType, (serviceBreakdown.get(serviceType) || 0) + total);

      if (daysOverdue > 0) {
        totalVencido += total;
        if (q.clientName) {
          clientesVencidos.add(q.clientName.trim().toLowerCase());
        }
        totalDiasRetraso += daysOverdue;
        countVencidos++;

        if (daysOverdue <= 30) {
          aging.r1_30 += total;
        } else if (daysOverdue <= 60) {
          aging.r31_60 += total;
        } else if (daysOverdue <= 90) {
          aging.r61_90 += total;
        } else {
          aging.r90_plus += total;
        }
      } else {
        aging.corriente += total;
      }
    });

    const promedioRetraso = countVencidos > 0 ? totalDiasRetraso / countVencidos : 0;

    return {
      totalPorCobrar,
      totalVencido,
      clientesVencidosCount: clientesVencidos.size,
      promedioRetraso,
      aceptadasCount: aceptadas.length,
      vencidasCount: countVencidos,
      aging,
      serviceBreakdown: Array.from(serviceBreakdown.entries()).map(([name, amount]) => ({ name, amount }))
    };
  }, [filteredQuotes, getQuoteCalculations]);

  // Reset page number on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedClient, statusFilter, serviceTypeFilter, responsableFilter, date]);

  // Paginated quotes
  const totalPages = Math.ceil(filteredQuotes.length / itemsPerPage);
  const paginatedQuotes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredQuotes.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredQuotes, currentPage]);

  // Reset filters
  const handleClearFilters = () => {
    setSelectedClient(null);
    setStatusFilter("Todos");
    setServiceTypeFilter("Todos");
    setResponsableFilter("Todos");
    setDate(undefined);
    setSearchQuery("");
  };

  const hasActiveFilters = selectedClient !== null || statusFilter !== "Todos" || serviceTypeFilter !== "Todos" || responsableFilter !== "Todos" || date !== undefined || searchQuery !== "";

  // Mark quote as paid
  const handleMarkAsPaid = async (quote: Quote) => {
    try {
      const docRef = doc(db, "quotes", quote.id);
      await updateDoc(docRef, { status: "Pagada" });
      toast({
        title: "Cotización marcada como pagada",
        description: `La cotización ${quote.quoteNumber} para ${quote.clientName} ha sido cobrada correctamente.`,
      });
    } catch {
      toast({
        title: "Error al actualizar",
        description: "No se pudo actualizar el estado de la cotización.",
        variant: "destructive"
      });
    }
  };

  // Format currencies & dates
  const fmt = (n: number) => `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr.replace(/-/g, "/")).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC"
      });
    } catch {
      return dateStr;
    }
  };

  const formatExDate = (date?: Date | null) => {
    if (!date) return "—";
    try {
      return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC"
      });
    } catch {
      return "—";
    }
  };

  // Export to Excel (Split executive summaries & details)
  const handleDownloadExcel = () => {
    const dataToExport = filteredQuotes.map(q => {
      const { expirationDate, daysOverdue, paymentStatus, subtotal, ivaAmount, total } = getQuoteCalculations(q);
      return {
        "No. Cotización": q.quoteNumber || "—",
        "Cliente": q.clientName || "—",
        "Tipo de Servicio": q.tipoServicio || "—",
        "Responsable": q.responsable || "—",
        "Subtotal": subtotal,
        "IVA": ivaAmount,
        "Total": total,
        "Fecha Emisión": q.date ? formatDate(q.date) : "—",
        "Fecha Vencimiento": expirationDate ? formatExDate(expirationDate) : "—",
        "Días Vencidos": daysOverdue > 0 ? daysOverdue : (q.status === "Pagada" ? "—" : 0),
        "Estado de Pago": paymentStatus.label,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle CxC");

    if (userProfile?.role === "admin") {
      const summaryData = [
        ["RESUMEN EJECUTIVO DE CUENTAS POR COBRAR - LEBAREF"],
        [],
        ["Indicador Financiero", "Valor"],
        ["Total por Cobrar", stats.totalPorCobrar],
        ["Monto Vencido", stats.totalVencido],
        ["Clientes en Mora", stats.clientesVencidosCount],
        ["Retraso Promedio (días)", Math.round(stats.promedioRetraso)],
        [],
        ["ANTIGÜEDAD DE SALDOS (AGING)"],
        ["Brackets", "Monto"],
        ["Al corriente", stats.aging.corriente],
        ["1 a 30 días", stats.aging.r1_30],
        ["31 a 60 días", stats.aging.r31_60],
        ["61 a 90 días", stats.aging.r61_90],
        ["Más de 90 días", stats.aging.r90_plus],
        [],
        ["DEUDA POR LÍNEA DE NEGOCIO"],
        ["Línea de Servicio", "Monto"]
      ];

      stats.serviceBreakdown.forEach(s => {
        summaryData.push([s.name, s.amount]);
      });

      const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summaryWorksheet, "Resumen Ejecutivo");
    }

    XLSX.writeFile(workbook, `Reporte_Cuentas_Por_Cobrar_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // Export to PDF (Landscape orientation + structured executive summaries)
  const handleDownloadPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const todayStr = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es });
    const primaryColor: [number, number, number] = [41, 71, 121];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(41, 71, 121);
    doc.text("Reporte de Cuentas por Cobrar", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Fecha de generación: ${todayStr}`, 14, 24);
    doc.text(`Filtros aplicados - Cliente: ${selectedClient || "Todos"} | Servicio: ${serviceTypeFilter} | Responsable: ${responsableFilter} | Estado: ${statusFilter}`, 14, 29);

    // KPI Table
    autoTable(doc, {
      startY: 34,
      head: [["Total por Cobrar", "Monto Vencido", "Clientes en Mora", "Retraso Promedio"]],
      body: [[
        fmt(stats.totalPorCobrar),
        fmt(stats.totalVencido),
        `${stats.clientesVencidosCount}`,
        `${Math.round(stats.promedioRetraso)} días`
      ]],
      theme: "grid",
      headStyles: { fillColor: primaryColor, textColor: 255, halign: "center" },
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: "center" },
    });

    const kpiTableFinalY = (doc as any).lastAutoTable.finalY || 44;

    // Details List Table
    const tableData = filteredQuotes.map(q => {
      const { expirationDate, daysOverdue, paymentStatus, subtotal, ivaAmount, total } = getQuoteCalculations(q);
      return [
        q.quoteNumber || "—",
        q.clientName || "—",
        q.tipoServicio || "—",
        q.responsable || "—",
        fmt(subtotal),
        fmt(ivaAmount),
        fmt(total),
        q.date ? formatDate(q.date) : "—",
        expirationDate ? formatExDate(expirationDate) : "—",
        daysOverdue > 0 ? `${daysOverdue}` : "—",
        paymentStatus.label
      ];
    });

    autoTable(doc, {
      startY: kpiTableFinalY + 8,
      head: [["Folio", "Cliente", "Servicio", "Responsable", "Subtotal", "IVA", "Total", "Emisión", "Vencimiento", "Días Venc.", "Estado"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: primaryColor, textColor: 255 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 42 },
        2: { cellWidth: 25 },
        3: { cellWidth: 30 },
        4: { cellWidth: 22, halign: "right" },
        5: { cellWidth: 18, halign: "right" },
        6: { cellWidth: 22, halign: "right" },
        7: { cellWidth: 20 },
        8: { cellWidth: 20 },
        9: { cellWidth: 15, halign: "center" },
        10: { cellWidth: 32 }
      }
    });

    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7).setTextColor(120);
      doc.text(`LEBAREF | Reporte de Cobranza - Generado el ${todayStr} | Página ${i} de ${totalPages}`, 14, 200);
    }

    doc.save(`Reporte_Cuentas_Por_Cobrar_${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (isLoading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-3">Cargando módulo de cobranza...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cobranza & Cuentas por Cobrar</h1>
          <p className="text-muted-foreground text-sm">Monitoreo de plazos de pago y estados de cartera.</p>
        </div>
        <div className="flex items-center gap-2">
          {userProfile?.role === "admin" && (
            <Button
              onClick={() => setShowSummary(prev => !prev)}
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-200 hover:bg-blue-50 text-blue-700 hover:text-blue-800"
            >
              {showSummary ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Ocultar Resumen
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Mostrar Resumen
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards - Only visible to admin */}
      {userProfile?.role === "admin" && showSummary && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="relative overflow-hidden border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total por Cobrar</CardTitle>
                <div className="p-2 bg-blue-50 rounded-full text-blue-600">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{fmt(stats.totalPorCobrar)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.aceptadasCount} cotizaciones aceptadas
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-l-4 border-l-red-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monto Vencido</CardTitle>
                <div className="p-2 bg-red-50 rounded-full text-red-600">
                  <AlertCircle className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">{fmt(stats.totalVencido)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.vencidasCount} deudas vencidas
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Clientes en Mora</CardTitle>
                <div className="p-2 bg-orange-50 rounded-full text-orange-600">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-700">{stats.clientesVencidosCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Clientes con cartera vencida
                </p>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-l-4 border-l-yellow-500 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Retraso Promedio</CardTitle>
                <div className="p-2 bg-yellow-50 rounded-full text-yellow-600">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-700">{Math.round(stats.promedioRetraso)} días</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Días de retraso promedio
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Distribution Charts Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Antigüedad de Saldos (Aging)
                </CardTitle>
                <CardDescription>Clasificación de la cartera por días de retraso</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {[
                  { label: "Al corriente", amount: stats.aging.corriente, color: "bg-green-500" },
                  { label: "1 a 30 días", amount: stats.aging.r1_30, color: "bg-yellow-500" },
                  { label: "31 a 60 días", amount: stats.aging.r31_60, color: "bg-orange-400" },
                  { label: "61 a 90 días", amount: stats.aging.r61_90, color: "bg-orange-600" },
                  { label: "Más de 90 días", amount: stats.aging.r90_plus, color: "bg-red-600" },
                ].map(b => {
                  const pct = stats.totalPorCobrar > 0 ? (b.amount / stats.totalPorCobrar) * 100 : 0;
                  return (
                    <div key={b.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span>{b.label}</span>
                        <span className="font-mono text-muted-foreground">
                          {fmt(b.amount)} ({Math.round(pct)}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-500", b.color)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2 border-b">
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Deuda por Línea de Negocio
                </CardTitle>
                <CardDescription>Cartera pendiente distribuida por tipo de servicio</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 max-h-[290px] overflow-y-auto pr-1">
                {stats.serviceBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No hay deuda activa registrada.</p>
                ) : (
                  stats.serviceBreakdown
                    .sort((a, b) => b.amount - a.amount)
                    .map(s => {
                      const pct = stats.totalPorCobrar > 0 ? (s.amount / stats.totalPorCobrar) * 100 : 0;
                      return (
                        <div key={s.name} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <span className="truncate max-w-[180px]">{s.name}</span>
                            <span className="font-mono text-muted-foreground">
                              {fmt(s.amount)} ({Math.round(pct)}%)
                            </span>
                          </div>
                          <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1.5">
            <CardTitle className="text-lg font-bold">Detalle de Cuentas por Cobrar</CardTitle>
            <CardDescription>Busca, filtra y concilia cotizaciones con días de crédito.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-primary/20 hover:border-primary/50 text-foreground hover:bg-muted shadow-sm transition-all duration-200"
                >
                  <Download className="h-4 w-4 text-primary animate-pulse" />
                  <span className="font-semibold text-xs sm:text-sm">Generar Reporte</span>
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px] p-1.5 shadow-md rounded-xl border border-muted-foreground/10 bg-background/95 backdrop-blur-sm">
                <DropdownMenuItem 
                  onClick={handleDownloadExcel} 
                  className="gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-green-50 hover:text-green-700 transition-colors"
                >
                  <div className="p-1 bg-green-100 rounded text-green-700">
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <span>Exportar a Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDownloadPDF} 
                  className="gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm font-medium hover:bg-red-50 hover:text-red-700 transition-colors"
                >
                  <div className="p-1 bg-red-100 rounded text-red-700">
                    <Download className="h-3.5 w-3.5" />
                  </div>
                  <span>Exportar a PDF</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Unified Grid Filters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            
            {/* 1. Date Range picker */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Rango de fechas</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="date"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-background",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, "dd/MM/yy")} - {format(date.to, "dd/MM/yy")}
                          </>
                        ) : (
                          format(date.from, "dd/MM/yy")
                        )
                      ) : (
                        "Filtrar fecha..."
                      )}
                    </span>
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
            </div>

            {/* 2. Client Combobox */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Cliente</span>
              <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" role="combobox" className="w-full justify-between text-left font-normal">
                    <span className="truncate">{selectedClient || "Todos"}</span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem value="all" onSelect={() => { setSelectedClient(null); setIsClientPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", !selectedClient ? "opacity-100" : "opacity-0")} />
                          Todos los clientes
                        </CommandItem>
                        {clientsWithDebts.map((clientName) => (
                          <CommandItem
                            key={clientName}
                            value={clientName}
                            onSelect={() => {
                              setSelectedClient(clientName);
                              setIsClientPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedClient === clientName ? "opacity-100" : "opacity-0")} />
                            {clientName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* 3. Service Type Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Línea de servicio</span>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-full bg-background h-9">
                  <SelectValue placeholder="Línea de servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todas las líneas</SelectItem>
                  {uniqueServiceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. Responsable Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Responsable</span>
              <Select value={responsableFilter} onValueChange={setResponsableFilter}>
                <SelectTrigger className="w-full bg-background h-9">
                  <SelectValue placeholder="Responsable" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Todos los responsables</SelectItem>
                  {uniqueResponsables.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Status Select */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Estado de cobro</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full bg-background h-9">
                  <SelectValue placeholder="Estado de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todos">Pendientes (Activos)</SelectItem>
                  <SelectItem value="Al corriente">Al corriente</SelectItem>
                  <SelectItem value="Por vencer">Por vencer</SelectItem>
                  <SelectItem value="Vencida">Vencidas</SelectItem>
                  <SelectItem value="Pagada">Pagadas (Referencia)</SelectItem>
                  <SelectItem value="Todas">Todas (Historial)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 6. Text Search / Clear filters */}
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1 flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground">Búsqueda</span>
                <Input
                  placeholder="Folio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9"
                />
              </div>
              {hasActiveFilters && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={handleClearFilters} className="h-9 w-9 text-muted-foreground hover:text-foreground self-end mb-[1px]">
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

          </div>

          {/* Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">No. Cotización</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="w-[120px]">Servicio</TableHead>
                  <TableHead className="w-[120px]">Responsable</TableHead>
                  <TableHead className="text-right w-[100px]">Subtotal</TableHead>
                  <TableHead className="text-right w-[90px]">IVA (16%)</TableHead>
                  <TableHead className="text-right w-[100px]">Total</TableHead>
                  <TableHead className="w-[100px]">Emisión</TableHead>
                  <TableHead className="w-[100px]">Vencimiento</TableHead>
                  <TableHead className="w-[90px] text-center">Días Venc.</TableHead>
                  <TableHead className="w-[150px]">Estado de Pago</TableHead>
                  <TableHead className="w-[90px] text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedQuotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-24 text-center text-muted-foreground">
                      No se encontraron cuentas por cobrar con los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedQuotes.map((quote) => {
                    const { expirationDate, daysOverdue, paymentStatus, subtotal, ivaAmount, total } = getQuoteCalculations(quote);
                    return (
                      <TableRow key={quote.id}>
                        <TableCell className="font-semibold">{quote.quoteNumber || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={quote.clientName}>{quote.clientName || "—"}</TableCell>
                        <TableCell className="truncate max-w-[120px]" title={quote.tipoServicio}>{quote.tipoServicio || "—"}</TableCell>
                        <TableCell className="truncate max-w-[120px]" title={quote.responsable}>{quote.responsable || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(subtotal)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{fmt(ivaAmount)}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{fmt(total)}</TableCell>
                        <TableCell className="text-xs">{formatDate(quote.date)}</TableCell>
                        <TableCell className="text-xs">{formatExDate(expirationDate)}</TableCell>
                        <TableCell className="text-center font-mono">
                          {daysOverdue > 0 ? (
                            <span className="text-red-600 font-bold">{daysOverdue}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("flex items-center gap-1.5 w-fit font-medium py-0.5 text-xs", paymentStatus.color)}>
                            {paymentStatus.icon}
                            {paymentStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* CheckCircle validation - Only enabled for Aceptada */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={quote.status !== "Aceptada"}
                                    onClick={() => handleMarkAsPaid(quote)}
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 disabled:opacity-30"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    <span className="sr-only">Marcar como pagada</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Marcar como pagada</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>

                            {/* Link to quote page */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => router.push(`/admin/quotes?id=${quote.id}`)}
                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    <span className="sr-only">Ver cotización</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ver/Editar cotización</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end space-x-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground px-2">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}

