

"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon, Loader2, DollarSign, FileText, ShoppingCart, AreaChart, Download, ChevronsUpDown, Check, Eraser } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, sub, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Quote } from '@/components/admin/quote-manager';
import type { PurchaseOrder } from '@/components/admin/purchase-order-manager';
import type { Supplier } from '@/components/admin/supplier-manager';
import type { Client } from '@/components/admin/client-manager';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';
import { useRouter } from 'next/navigation';
import * as XLSX from "xlsx";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type UserProfile = {
  role: 'admin' | 'employee';
  permissions?: { [key: string]: boolean };
};

const StatCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

export default function ReportsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [date, setDate] = useState<DateRange | undefined>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [activeTab, setActiveTab] = useState('sales');
    const [selectedClient, setSelectedClient] = useState<string | null>(null);
    const [isClientPopoverOpen, setIsClientPopoverOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
    const [isSupplierPopoverOpen, setIsSupplierPopoverOpen] = useState(false);


    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/');
            return;
        }
        const unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const profile = docSnap.data() as UserProfile;
                setUserProfile(profile);
                if (profile.role !== 'admin' && !profile.permissions?.reports) {
                    router.push('/admin');
                }
            }
        });
        return () => unsub();
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!userProfile) return;
        setIsLoading(true);

        const unsubs: (()=>void)[] = [];

        unsubs.push(onSnapshot(collection(db, 'quotes'), (snapshot) => {
            setQuotes(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Quote)));
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'quotes', operation: 'list'}))));
        
        unsubs.push(onSnapshot(collection(db, 'purchase_orders'), (snapshot) => {
            setPurchaseOrders(snapshot.docs.map(d => ({id: d.id, ...d.data()} as PurchaseOrder)));
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'purchase_orders', operation: 'list'}))));

        unsubs.push(onSnapshot(collection(db, 'suppliers'), (snapshot) => {
            setSuppliers(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Supplier)));
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'suppliers', operation: 'list'}))));
        
        unsubs.push(onSnapshot(collection(db, 'clients'), (snapshot) => {
            setClients(snapshot.docs.map(d => ({id: d.id, ...d.data()} as Client)));
        }, (err) => errorEmitter.emit('permission-error', new FirestorePermissionError({path: 'clients', operation: 'list'}))));

        setIsLoading(false);
        return () => unsubs.forEach(unsub => unsub());

    }, [userProfile]);

    const handleClearFilters = () => {
        setDate({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
        setSelectedClient(null);
        setSelectedSupplier(null);
    }

    if (isLoading || authLoading) {
        return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                 <div className="flex items-center gap-3">
                    <AreaChart className="w-6 h-6" />
                    <h1 className="text-2xl font-bold">Reportes</h1>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"outline"}
                                className={cn("w-[300px] justify-start text-left font-normal", !date && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? (
                                    date.to ? (
                                        <>
                                            {format(date.from, "d 'de' LLL, y", { locale: es })} -{" "}
                                            {format(date.to, "d 'de' LLL, y", { locale: es })}
                                        </>
                                    ) : format(date.from, "d 'de' LLL, y", { locale: es })
                                ) : <span>Seleccionar rango de fechas</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
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
                    {activeTab === 'sales' && (
                         <Popover open={isClientPopoverOpen} onOpenChange={setIsClientPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-[300px] justify-start text-left font-normal">
                                    {selectedClient || "Filtrar por cliente..."}
                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar cliente..." />
                                    <CommandList>
                                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem value="all" onSelect={() => { setSelectedClient(null); setIsClientPopoverOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", !selectedClient ? "opacity-100" : "opacity-0")} />
                                                Todos los clientes
                                            </CommandItem>
                                            {clients.map((client) => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.name}
                                                    onSelect={() => {
                                                        setSelectedClient(client.name);
                                                        setIsClientPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedClient === client.name ? "opacity-100" : "opacity-0")} />
                                                    {client.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    )}
                    {activeTab === 'purchases' && (
                         <Popover open={isSupplierPopoverOpen} onOpenChange={setIsSupplierPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-[300px] justify-start text-left font-normal">
                                    {selectedSupplier || "Filtrar por proveedor..."}
                                    <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar proveedor..." />
                                    <CommandList>
                                        <CommandEmpty>No se encontraron proveedores.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem value="all" onSelect={() => { setSelectedSupplier(null); setIsSupplierPopoverOpen(false); }}>
                                                <Check className={cn("mr-2 h-4 w-4", !selectedSupplier ? "opacity-100" : "opacity-0")} />
                                                Todos los proveedores
                                            </CommandItem>
                                            {suppliers.map((supplier) => (
                                                <CommandItem
                                                    key={supplier.id}
                                                    value={supplier.name}
                                                    onSelect={() => {
                                                        setSelectedSupplier(supplier.name);
                                                        setIsSupplierPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedSupplier === supplier.name ? "opacity-100" : "opacity-0")} />
                                                    {supplier.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    )}
                    {(selectedClient || selectedSupplier) && (
                         <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" onClick={handleClearFilters} size="icon">
                                        <Eraser className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Limpiar Filtros</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </div>

            <Tabs defaultValue="sales" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="sales">Ventas</TabsTrigger>
                    <TabsTrigger value="purchases">Compras</TabsTrigger>
                </TabsList>
                <TabsContent value="sales" className="mt-4">
                    <VentasReportTab allQuotes={quotes} range={date} selectedClient={selectedClient} />
                </TabsContent>
                <TabsContent value="purchases" className="mt-4">
                    <ComprasReportTab allPurchaseOrders={purchaseOrders} allSuppliers={suppliers} range={date} selectedSupplier={selectedSupplier} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function VentasReportTab({ allQuotes, range, selectedClient }: { allQuotes: Quote[], range?: DateRange, selectedClient: string | null }) {
    const { currentPeriodStats } = useMemo(() => {
        if (!range?.from || !range?.to) return { currentPeriodStats: null };

        const processData = (startDate: Date, endDate: Date) => {
            let filteredQuotes = allQuotes.filter(q => {
                const quoteDate = new Date(q.date);
                return quoteDate >= startDate && quoteDate <= endDate;
            });
            
            if (selectedClient) {
                filteredQuotes = filteredQuotes.filter(q => q.clientName === selectedClient);
            }

            const accepted = filteredQuotes.filter(q => q.status === 'Aceptada');
            const rejected = filteredQuotes.filter(q => q.status === 'Rechazada');
            const paid = filteredQuotes.filter(q => q.status === 'Pagada');
            const totalIncome = paid.reduce((sum, q) => sum + q.total, 0);

            return {
                acceptedCount: accepted.length,
                rejectedCount: rejected.length,
                paidCount: paid.length,
                totalIncome: totalIncome,
            };
        };

        const currentPeriodStats = processData(range.from, range.to);

        return { currentPeriodStats };

    }, [allQuotes, range, selectedClient]);

    const handleDownloadVentas = () => {
        if (!range?.from || !range.to) return;
        let paidQuotesInRange = allQuotes.filter(q => {
            const quoteDate = new Date(q.date.replace(/-/g, '\/'));
            const isInRange = quoteDate >= range.from! && quoteDate <= range.to!;
            return q.status === 'Pagada' && isInRange;
        });

        if (selectedClient) {
            paidQuotesInRange = paidQuotesInRange.filter(q => q.clientName === selectedClient);
        }

        const dataToExport = paidQuotesInRange.map(q => ({
            'ID Cotización': q.quoteNumber,
            'Cliente': q.clientName,
            'Fecha': new Date(q.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}),
            'Total': q.total,
            'Estado': q.status,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte de Ventas");
        
        const clientFileNamePart = selectedClient ? `${selectedClient.replace(/ /g, '_')}_` : '';
        const fileName = `Reporte_Ventas_${clientFileNamePart}${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleDownloadVentasPDF = () => {
        if (!range?.from || !range.to || !currentPeriodStats) return;

        const doc = new jsPDF();
        const clientName = selectedClient || "Todos los clientes";
        const dateRangeStr = `Del ${format(range.from, "d MMM yyyy", { locale: es })} al ${format(range.to, "d MMM yyyy", { locale: es })}`;

        // Title
        doc.setFontSize(18);
        doc.text("Reporte de Ventas", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Cliente: ${clientName}`, 14, 30);
        doc.text(`Periodo: ${dateRangeStr}`, 14, 36);

        // Stats
        autoTable(doc, {
            startY: 45,
            head: [['Métrica', 'Valor']],
            body: [
                ['Ingresos Totales', `$${currentPeriodStats.totalIncome.toLocaleString('es-MX')}`],
                ['Cotizaciones Aceptadas', `${currentPeriodStats.acceptedCount}`],
                ['Cotizaciones Pagadas', `${currentPeriodStats.paidCount}`],
                ['Cotizaciones Rechazadas', `${currentPeriodStats.rejectedCount}`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [41, 71, 121] },
        });
        
        let paidQuotesInRange = allQuotes.filter(q => {
            const quoteDate = new Date(q.date.replace(/-/g, '\/'));
            const isInRange = quoteDate >= range.from! && quoteDate <= range.to!;
            return q.status === 'Pagada' && isInRange;
        });

        if (selectedClient) {
            paidQuotesInRange = paidQuotesInRange.filter(q => q.clientName === selectedClient);
        }
        
        if (paidQuotesInRange.length > 0) {
             autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['ID Cotización', 'Cliente', 'Fecha', 'Total']],
                body: paidQuotesInRange.map(q => [
                    q.quoteNumber,
                    q.clientName,
                    new Date(q.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}),
                    `$${q.total.toLocaleString('es-MX')}`
                ]),
                headStyles: { fillColor: [41, 71, 121] },
            });
        } else {
             doc.text("No hay cotizaciones pagadas para este periodo y cliente.", 14, (doc as any).lastAutoTable.finalY + 10);
        }

        const clientFileNamePart = selectedClient ? `${selectedClient.replace(/ /g, '_')}_` : '';
        const fileName = `Reporte_Ventas_PDF_${clientFileNamePart}${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.pdf`;
        doc.save(fileName);
    };

    if (!currentPeriodStats) return <div>Seleccione un rango de fechas para ver el reporte.</div>;

    return (
        <div className="grid gap-6">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Ingresos Totales" value={`$${currentPeriodStats.totalIncome.toLocaleString('es-MX')}`} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Cotizaciones Aceptadas" value={`${currentPeriodStats.acceptedCount}`} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Cotizaciones Pagadas" value={`${currentPeriodStats.paidCount}`} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Cotizaciones Rechazadas" value={`${currentPeriodStats.rejectedCount}`} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
            </div>
            <div className="flex justify-end mt-4 gap-2">
                <Button onClick={handleDownloadVentasPDF} variant="outline" disabled={!range?.from || !range.to}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                </Button>
                <Button onClick={handleDownloadVentas} disabled={!range?.from || !range.to}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                </Button>
            </div>
        </div>
    );
}

function ComprasReportTab({ allPurchaseOrders, range, selectedSupplier }: { allPurchaseOrders: PurchaseOrder[], allSuppliers: Supplier[], range?: DateRange, selectedSupplier: string | null }) {
     const { currentPeriodStats } = useMemo(() => {
        if (!range?.from || !range?.to) return { currentPeriodStats: null };

        const processData = (startDate: Date, endDate: Date) => {
            let filteredPOs = allPurchaseOrders.filter(po => {
                const poDate = new Date(po.date);
                return poDate >= startDate && poDate <= endDate;
            });
            
            if (selectedSupplier) {
                filteredPOs = filteredPOs.filter(po => po.supplierName === selectedSupplier);
            }

            const totalSpending = filteredPOs.reduce((sum, po) => sum + po.total, 0);

            return {
                totalSpending,
                poCount: filteredPOs.length
            };
        };

        const currentPeriodStats = processData(range.from, range.to);

        return { currentPeriodStats };

    }, [allPurchaseOrders, range, selectedSupplier]);
    
    const handleDownloadCompras = () => {
        if (!range?.from || !range?.to) return;
        let poInRange = allPurchaseOrders.filter(po => {
            const poDate = new Date(po.date.replace(/-/g, '\/'));
            return poDate >= range.from! && poDate <= range.to!;
        });

        if (selectedSupplier) {
            poInRange = poInRange.filter(po => po.supplierName === selectedSupplier);
        }

        const dataToExport = poInRange.map(po => ({
            'ID Orden': po.purchaseOrderNumber,
            'Proveedor': po.supplierName,
            'Fecha': new Date(po.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}),
            'Total': po.total,
            'Estado': po.status,
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte de Compras");
        
        const supplierFileNamePart = selectedSupplier ? `${selectedSupplier.replace(/ /g, '_')}_` : '';
        const fileName = `Reporte_Compras_${supplierFileNamePart}${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleDownloadComprasPDF = () => {
        if (!range?.from || !range?.to || !currentPeriodStats) return;
    
        const doc = new jsPDF();
        const supplierName = selectedSupplier || "Todos los proveedores";
        const dateRangeStr = `Del ${format(range.from, "d MMM yyyy", { locale: es })} al ${format(range.to, "d MMM yyyy", { locale: es })}`;
    
        doc.setFontSize(18);
        doc.text("Reporte de Compras", 14, 22);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text(`Proveedor: ${supplierName}`, 14, 30);
        doc.text(`Periodo: ${dateRangeStr}`, 14, 36);
    
        autoTable(doc, {
            startY: 45,
            head: [['Métrica', 'Valor']],
            body: [
                ['Gasto Total', `$${currentPeriodStats.totalSpending.toLocaleString('es-MX')}`],
                ['Órdenes de Compra', `${currentPeriodStats.poCount}`],
            ],
            theme: 'striped',
            headStyles: { fillColor: [41, 71, 121] },
        });
        
        let poInRange = allPurchaseOrders.filter(po => {
            const poDate = new Date(po.date.replace(/-/g, '\/'));
            const isInRange = poDate >= range.from! && poDate <= range.to!;
            return isInRange;
        });
    
        if (selectedSupplier) {
            poInRange = poInRange.filter(po => po.supplierName === selectedSupplier);
        }
        
        if (poInRange.length > 0) {
             autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 10,
                head: [['ID Orden', 'Proveedor', 'Fecha', 'Total', 'Estado']],
                body: poInRange.map(po => [
                    po.purchaseOrderNumber,
                    po.supplierName,
                    new Date(po.date.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}),
                    `$${po.total.toLocaleString('es-MX')}`,
                    po.status
                ]),
                headStyles: { fillColor: [41, 71, 121] },
            });
        } else {
             doc.text("No hay órdenes de compra para este periodo y proveedor.", 14, (doc as any).lastAutoTable.finalY + 10);
        }
    
        const supplierFileNamePart = selectedSupplier ? `${selectedSupplier.replace(/ /g, '_')}_` : '';
        const fileName = `Reporte_Compras_PDF_${supplierFileNamePart}${format(range.from, "yyyy-MM-dd")}_a_${format(range.to, "yyyy-MM-dd")}.pdf`;
        doc.save(fileName);
    };

    if (!currentPeriodStats) return <div>Seleccione un rango de fechas para ver el reporte.</div>;

    return (
         <div className="grid gap-6">
            <div className="grid md:grid-cols-2 gap-6">
                <StatCard title="Gasto Total" value={`$${currentPeriodStats.totalSpending.toLocaleString('es-MX')}`} icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />} />
                <StatCard title="Órdenes de Compra" value={`${currentPeriodStats.poCount}`} icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
            </div>
            <div className="flex justify-end mt-4 gap-2">
                <Button onClick={handleDownloadComprasPDF} variant="outline" disabled={!range?.from || !range.to}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar PDF
                </Button>
                <Button onClick={handleDownloadCompras} disabled={!range?.from || !range.to}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                </Button>
            </div>
        </div>
    );
}

    




