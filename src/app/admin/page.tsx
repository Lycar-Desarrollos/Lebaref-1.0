

"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where, orderBy, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, FileText, ShoppingCart, List, Loader2, Download, FileSpreadsheet } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
};

type UserProfile = {
    role: 'admin' | 'employee';
};

type Project = {
    id: string;
    client: string;
    description: string;
    responsible: string;
    status: "Nuevo" | "En Progreso" | "En Pausa" | "Completado";
    programmedDate: string;
    priority: "Baja" | "Media" | "Alta";
    userId: string;
    lastUpdated: any;
    createdAt: any;
    quoteId?: string;
};

type QuoteItem = {
  description: string;
  quantity: number;
  price: number;
  unidad?: string;
};

type Quote = {
  id: string;
  quoteNumber: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  clientAddress: string;
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
};

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


const StatCard = ({ title, value, icon, description }: StatCardProps) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </CardContent>
  </Card>
);

export default function AdminDashboardPage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    quotes: 0,
    pendingQuotes: 0,
    purchaseOrders: 0,
    projects: 0,
  });
  const [inProgressProjects, setInProgressProjects] = useState<Project[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const PROJECTS_PER_PAGE = 10;

  useEffect(() => {
    if (authIsLoading) {
      return;
    }
    if (!user) {
      router.push('/');
      return;
    }

    let dataListenersUnsubs: (() => void)[] = [];

    const profileUnsub = onSnapshot(doc(db, "users", user.uid), (profileDoc) => {
      dataListenersUnsubs.forEach(unsub => unsub());
      dataListenersUnsubs = [];

      if (!profileDoc.exists()) {
        setIsLoading(false);
        console.error("User profile document not found!");
        return;
      }
      
      const userProfile = profileDoc.data() as UserProfile;
      const is_admin = userProfile.role === 'admin';
      
      const projectsQuery = query(collection(db, "projects"), where("status", "==", "En Progreso"), orderBy("programmedDate", "asc"));

      dataListenersUnsubs.push(onSnapshot(projectsQuery, (snapshot) => {
          const projectsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
          setInProgressProjects(projectsData);
          setIsLoading(false);
      }, (error) => {
          console.error("Firestore error fetching projects. This might be due to a missing composite index.", error);
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'projects', operation: 'list' }));
          setIsLoading(false);
      }));

      const quotesStatsQuery = is_admin 
        ? query(collection(db, "quotes"))
        : query(collection(db, "quotes"), where("userId", "==", user.uid));
        
      const projectsStatsQuery = is_admin
        ? query(collection(db, "projects"))
        : query(collection(db, "projects"), where("userId", "==", user.uid));
        
      const purchaseOrdersStatsQuery = is_admin
        ? query(collection(db, "purchase_orders"))
        : query(collection(db, "purchase_orders"), where("userId", "==", user.uid));

      dataListenersUnsubs.push(onSnapshot(quotesStatsQuery, (snapshot) => {
        const quotesData = snapshot.docs.map(doc => doc.data());
        const pendingQuotes = quotesData.filter(q => q.status === 'Enviada' || q.status === 'Borrador').length;
        setStats(prev => ({ ...prev, quotes: quotesData.length, pendingQuotes }));
        const fullQuotesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data()} as Quote));
        setQuotes(fullQuotesData);
      }, () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "quotes", operation: 'list' }));
      }));

      dataListenersUnsubs.push(onSnapshot(projectsStatsQuery, (snapshot) => {
          setStats(prev => ({ ...prev, projects: snapshot.size }));
      }, () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "projects", operation: 'list' }));
      }));
      
      dataListenersUnsubs.push(onSnapshot(purchaseOrdersStatsQuery, (snapshot) => {
          setStats(prev => ({ ...prev, purchaseOrders: snapshot.size }));
      }, () => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({ path: "purchase_orders", operation: 'list' }));
      }));

    }, (error) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `users/${user.uid}`, operation: 'get' }));
      setIsLoading(false);
    });

    return () => {
      profileUnsub();
      dataListenersUnsubs.forEach(unsub => unsub());
    };
  }, [user, authIsLoading, router]);

  const paginatedProjects = inProgressProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );
  const totalPages = Math.ceil(inProgressProjects.length / PROJECTS_PER_PAGE);

   if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
        <StatCard 
          title="Total de Cotizaciones" 
          value={stats.quotes} 
          icon={<FileText className="h-4 w-4 text-muted-foreground" />} 
          description="Todas las cotizaciones históricas."
        />
        <StatCard 
          title="Pendientes General" 
          value={stats.pendingQuotes} 
          icon={<List className="h-4 w-4 text-muted-foreground" />}
          description="Cotizaciones en 'Borrador' o 'Enviada'."
        />
        <StatCard 
          title="Órdenes de Compra" 
          value={stats.purchaseOrders}
          icon={<ShoppingCart className="h-4 w-4 text-muted-foreground" />}
          description="Total de órdenes de compra creadas."
        />
         <StatCard 
          title="Proyectos" 
          value={stats.projects}
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
          description="Total de proyectos registrados."
        />
      </div>
      <div className="mt-8">
        <Card>
            <CardHeader>
                <CardTitle>Proyectos en Proceso</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : paginatedProjects.length > 0 ? (
                    <>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Responsable</TableHead>
                                        <TableHead>Cotización</TableHead>
                                        <TableHead>Prioridad</TableHead>
                                        <TableHead>Fecha Prog.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedProjects.map((project) => (
                                        <TableRow key={project.id}>
                                            <TableCell>{project.client}</TableCell>
                                            <TableCell className="max-w-xs truncate">{project.description}</TableCell>
                                            <TableCell>{project.responsible}</TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const linkedQuote = quotes.find(q => q.id === project.quoteId);
                                                    if (linkedQuote) {
                                                        return (
                                                            <div className="flex items-center gap-1 whitespace-nowrap">
                                                                <span className="font-medium">{linkedQuote.quoteNumber}</span>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => await downloadQuotePDF(linkedQuote)}>
                                                                    <Download className="h-4 w-4" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadQuoteExcel(linkedQuote)}>
                                                                    <FileSpreadsheet className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        );
                                                    }
                                                    return 'N/A';
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={cn('capitalize', {
                                                    'text-red-600 border-red-600': project.priority === 'Alta',
                                                    'text-yellow-600 border-yellow-600': project.priority === 'Media',
                                                    'text-green-600 border-green-600': project.priority === 'Baja',
                                                })}>{project.priority}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                {project.programmedDate ? new Date(project.programmedDate.replace(/-/g, '\/')).toLocaleDateString('es-MX', {timeZone: 'UTC'}) : 'N/A'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                            >
                                Siguiente
                            </Button>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
                        <p className="text-muted-foreground">No hay proyectos en proceso actualmente.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </>
  );
}

    

    


