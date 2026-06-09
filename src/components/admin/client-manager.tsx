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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Loader2, 
  PlusCircle, 
  MoreHorizontal, 
  Edit, 
  Trash2,
  Building,
  User as UserIcon,
  CreditCard,
  History,
  Clock,
  Briefcase,
  MapPin,
  Calendar,
  ShieldAlert,
  FileText,
  Mail,
  Phone,
  Check,
  Building2,
  AlertTriangle,
  Eye
} from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";

// Sub-esquema para Contacto Clave
const contactSchema = z.object({
  name: z.string().optional().or(z.literal('')),
  puesto: z.string().optional().or(z.literal('')),
  depto: z.string().optional().or(z.literal('')),
  phoneDirect: z.string().optional().or(z.literal('')),
  celularWhatsapp: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
});

// Sub-esquema para Sucursal
const branchSchema = z.object({
  id: z.string(),
  name: z.string().min(2, { message: "El nombre es requerido." }),
  establishmentType: z.string().default("Sucursal"),
  streetAndNumber: z.string().optional().or(z.literal('')),
  municipality: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zipCode: z.string().optional().or(z.literal('')),
  address: z.string().optional(),
});

// Esquema Principal de Cliente Ampliado
const clientSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, { message: "El nombre o Razón Social es requerido." }),
  phone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos." }),
  email: z.string().email({ message: "Correo electrónico inválido." }).optional().or(z.literal('')),
  address: z.string().optional(),
  rfc: z.string().optional().or(z.literal('')),

  // 1. Datos Generales
  clientType: z.string().default("Persona moral"), // Persona física, Persona moral
  industry: z.string().default("Comercial"), // Cliente residencial, Comercial, Hotel, Casa, Negocio
  status: z.string().default("Activo"), // Activo, Inactivo, suspendido, perdido
  assignedSeller: z.string().optional().or(z.literal('')),
  priority: z.string().default("B"), // A, B, C, D (Alta, media, baja, nula)
  notes: z.string().optional().or(z.literal('')),
  
  // Dirección Desglosada
  streetAndNumber: z.string().optional().or(z.literal('')),
  municipality: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  zipCode: z.string().optional().or(z.literal('')),

  // Horarios de atención por día
  scheduleByDay: z.record(z.string(), z.object({
    enabled: z.boolean().default(false),
    open: z.string().optional().or(z.literal('')),
    close: z.string().optional().or(z.literal('')),
  })).default({}),

  // Requisitos de ingresos
  reqAccesos: z.boolean().default(false),
  reqPermisos: z.boolean().default(false),
  reqUniformes: z.boolean().default(false),
  reqHerramientas: z.boolean().default(false),
  reqNegativoDetails: z.string().optional().or(z.literal('')),
  reqPositivoDetails: z.string().optional().or(z.literal('')),

  // Servicio
  evidenceFormat: z.string().default("Estándar"), // Estándar, Personal
  serviceTypeRequired: z.array(z.string()).default([]), // Refrigeración, Electricidad, Obra Civil, Voz y Datos, Comercialización
  responseTimeRequired: z.string().optional().or(z.literal('')),
  quoteReceiptEmail: z.string().optional().or(z.literal('')),

  // 2. Contactos Claves
  contactoPrincipal: contactSchema.optional(),
  contactoPrincipalIsActive: z.boolean().default(true),
  contactoComprador: contactSchema.optional(),
  contactosSecundarios: z.array(contactSchema).default([]),

  // 3. Facturación y Cobranza
  regimenFiscal: z.string().optional().or(z.literal('')),
  usoCFDI: z.string().optional().or(z.literal('')),
  metodoPago: z.string().optional().or(z.literal('')),
  formaPago: z.string().optional().or(z.literal('')),
  diasCredito: z.coerce.number().min(0).default(0),
  limiteCredito: z.coerce.number().min(0).default(0),
  moneda: z.string().default("MXN"),
  datosFacturacionCompletos: z.string().optional().or(z.literal('')),
  correoFacturacion: z.string().optional().or(z.literal('')),
  contactoCuentasPorPagar: z.string().optional().or(z.literal('')),

  // 4. Sucursales (Subregistro)
  branches: z.array(branchSchema).default([]),

  // 5. Historial de Auditoría
  changelog: z.array(z.any()).default([]),
});

export type Client = z.infer<typeof clientSchema> & { id: string, createdAt: any };

export function ClientManager() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [sellers, setSellers] = useState<{ uid: string, displayName: string, email: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [filter, setFilter] = useState("");
  const { toast } = useToast();

  // Cargar Clientes
  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      setIsLoading(false);
      setClients([]);
      return;
    }
    
    setIsLoading(true);
    const clientsQuery = collection(db, "clients");
    const unsubscribe = onSnapshot(clientsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(data.sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        setIsLoading(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'clients', operation: 'list' }));
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, authIsLoading]);

  // Cargar Vendedores desde colección de usuarios (solo admins pueden listar usuarios)
  useEffect(() => {
    if (!user) return;

    // Primero verificamos si el usuario actual es admin leyendo su propio documento
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().role === 'admin') {
        // Solo si es admin, intentamos listar todos los usuarios para el selector de vendedores
        const usersQuery = collection(db, "users");
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
          const data = snapshot.docs.map(d => ({
            uid: d.id,
            displayName: d.data().displayName || d.data().email || "Usuario sin nombre",
            email: d.data().email || ""
          }));
          setSellers(data);
        }, () => {
          // Silenciar error si por alguna razón falla
        });
        // Guardamos la función de limpieza en una ref para poder desuscribirnos
        return () => unsubscribeUsers();
      }
      // Si no es admin, dejamos sellers vacío (el campo de vendedor es opcional)
    }, () => {
      // Error al leer perfil propio - silenciar, el layout ya lo maneja
    });

    return () => unsubscribeProfile();
  }, [user]);

  const handleSaveClient = useCallback(async (data: Omit<Client, 'id' | 'createdAt'>) => {
    // 1. Concatenar dirección desglosada en campo principal 'address'
    const fullAddress = [
      data.streetAndNumber,
      data.municipality,
      data.state,
      data.zipCode ? `CP ${data.zipCode}` : ""
    ].filter(Boolean).join(", ") || data.address || "Sin dirección";

    // 2. Registrar evento en Historial de Auditoría
    const changeEntry = {
      timestamp: new Date().toISOString(),
      userId: user?.uid || "unknown",
      userName: user?.displayName || user?.email || "Sistema",
      changeType: selectedClient ? "Edición" : "Creación",
      details: selectedClient
        ? `Se editó la información del cliente. Estatus actual: ${data.status}`
        : "Registro inicial de cliente en la cartera.",
    };

    // Actualizar historial acumulado
    const updatedChangelog = [...(data.changelog || []), changeEntry];

    const finalData = {
      ...data,
      address: fullAddress,
      changelog: updatedChangelog,
    };

    if (selectedClient?.id) {
        // En caso de que cambie a Inactivo, alertar al vendedor
        if (selectedClient.status !== data.status && data.status === "Inactivo" && data.assignedSeller) {
          const sellerObj = sellers.find(s => s.uid === data.assignedSeller || s.displayName === data.assignedSeller);
          toast({
            title: "Remitido a Seguimiento",
            description: `Se enviará un recordatorio automático a ${sellerObj?.displayName || data.assignedSeller} para seguimiento del cliente inactivo.`,
          });
        }

        const clientDoc = doc(db, "clients", selectedClient.id);
        try {
            await updateDoc(clientDoc, finalData);
            toast({ title: "Cliente Actualizado", description: "La información del cliente ha sido actualizada correctamente." });
        } catch(error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: clientDoc.path,
                operation: 'update',
                requestResourceData: finalData,
            }));
        }
    } else {
        const clientData = { ...finalData, createdAt: serverTimestamp() };
        const clientsCollection = collection(db, "clients");
        try {
            await addDoc(clientsCollection, clientData);
            toast({ title: "Cliente Creado", description: "Un nuevo cliente ha sido añadido a la cartera con éxito." });
        } catch(error) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: clientsCollection.path,
                operation: 'create',
                requestResourceData: clientData,
            }));
        }
    }
    setIsFormOpen(false);
    setSelectedClient(null);
  }, [selectedClient, toast, sellers, user]);

  const handleDeleteClient = useCallback(async (id: string) => {
    const clientDoc = doc(db, "clients", id);
    try {
      await deleteDoc(clientDoc);
      toast({ title: "Cliente Eliminado", variant: "destructive" });
    } catch(error) {
       errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: clientDoc.path,
            operation: 'delete',
        }));
    }
  }, [toast]);
  
  const columns: ColumnDef<Client>[] = useMemo(() => [
      { accessorKey: "name", header: "Nombre o Razón Social" },
      { 
        accessorKey: "status", 
        header: "Estatus",
        cell: ({ row }) => {
          const status = row.getValue("status") as string || "Activo";
          const colorMap: Record<string, string> = {
            "Activo": "bg-green-100 text-green-800 border-green-200",
            "Inactivo": "bg-gray-100 text-gray-800 border-gray-200",
            "suspendido": "bg-orange-100 text-orange-800 border-orange-200",
            "perdido": "bg-red-100 text-red-800 border-red-200"
          };
          return (
            <Badge variant="outline" className={`${colorMap[status] || "bg-blue-100 text-blue-800"}`}>
              {status}
            </Badge>
          );
        }
      },
      { 
        accessorKey: "priority", 
        header: "Prioridad",
        cell: ({ row }) => {
          const p = row.getValue("priority") as string || "B";
          const priorityMap: Record<string, { label: string, color: string }> = {
            "A": { label: "Alta (A)", color: "text-red-600 font-semibold" },
            "B": { label: "Media (B)", color: "text-orange-600" },
            "C": { label: "Baja (C)", color: "text-blue-600" },
            "D": { label: "Nula (D)", color: "text-muted-foreground" }
          };
          const resolved = priorityMap[p] || { label: `Media (${p})`, color: "text-orange-600" };
          return <span className={resolved.color}>{resolved.label}</span>;
        }
      },
      { accessorKey: "phone", header: "Teléfono" },
      { accessorKey: "email", header: "Correo Electrónico" },
      { accessorKey: "address", header: "Dirección" },
      { id: "actions",
        cell: ({ row }) => {
            const client = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => setViewClient(client)}><Eye className="mr-2 h-4 w-4"/> Visualizar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelectedClient(client); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Editar detalles</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <AlertDialog>
                            <AlertDialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()} className="text-red-500"><Trash2 className="mr-2 h-4 w-4"/> Eliminar cliente</DropdownMenuItem></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Confirmar eliminación?</AlertDialogTitle>
                                    <AlertDialogDescription>Esta acción eliminará el cliente permanentemente y no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteClient(client.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        }
      }
  ], [handleDeleteClient, setViewClient]);
  
  const table = useReactTable({ 
    data: clients, 
    columns, 
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter: filter },
    onGlobalFilterChange: setFilter,
  });

  if (isLoading && authIsLoading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div>
        <div className="flex justify-between items-center mb-4">
             <Input placeholder="Buscar por nombre, teléfono, estatus..." value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm"/>
            <Button onClick={() => { setSelectedClient(null); setIsFormOpen(true);}}><PlusCircle className="mr-2 h-4 w-4" /> Agregar Cliente</Button>
        </div>
        <div className="rounded-md border">
            <Table>
                <TableHeader>{table.getHeaderGroups().map(headerGroup => (<TableRow key={headerGroup.id}>{headerGroup.headers.map(header => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>))}</TableHeader>
                <TableBody>
                    {table.getRowModel().rows?.length ? (table.getRowModel().rows.map(row => (<TableRow key={row.id}>{row.getVisibleCells().map(cell => (<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>))}</TableRow>))) : (<TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay clientes en la cartera. Agrega el primero.</TableCell></TableRow>)}
                </TableBody>
            </Table>
        </div>
        <div className="flex items-center justify-end space-x-2 py-4">
            <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Anterior</Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Siguiente</Button>
        </div>

      <ClientFormDialog 
        isOpen={isFormOpen} 
        onOpenChange={setIsFormOpen} 
        onSave={handleSaveClient} 
        client={selectedClient}
        sellers={sellers}
      />

      <ClientViewDialog
        client={viewClient}
        sellers={sellers}
        onClose={() => setViewClient(null)}
        onEdit={(c) => { setViewClient(null); setSelectedClient(c); setIsFormOpen(true); }}
      />
    </div>
  );
}

interface ClientFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: Omit<Client, 'id' | 'createdAt'>) => void;
  client: Client | null;
  sellers: { uid: string, displayName: string, email: string }[];
}

function ClientFormDialog({ isOpen, onOpenChange, onSave, client, sellers }: ClientFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Sub-estados locales para agregar sucursales
    const [branchName, setBranchName] = useState("");
    const [branchType, setBranchType] = useState("Sucursal");
    const [branchStreet, setBranchStreet] = useState("");
    const [branchMuni, setBranchMuni] = useState("");
    const [branchState, setBranchState] = useState("");
    const [branchZip, setBranchZip] = useState("");

    // Sub-estados para contactos secundarios
    const [secName, setSecName] = useState("");
    const [secPuesto, setSecPuesto] = useState("");
    const [secDepto, setSecDepto] = useState("");
    const [secPhone, setSecPhone] = useState("");
    const [secWhatsapp, setSecWhatsapp] = useState("");
    const [secEmail, setSecEmail] = useState("");

    const form = useForm<z.infer<typeof clientSchema>>({
        resolver: zodResolver(clientSchema),
        defaultValues: { 
          name: "", 
          phone: "", 
          email: "", 
          address: "", 
          rfc: "",
          clientType: "Persona moral",
          industry: "Comercial",
          status: "Activo",
          assignedSeller: "",
          priority: "B",
          notes: "",
          streetAndNumber: "",
          municipality: "",
          state: "",
          zipCode: "",
          scheduleByDay: {},
          reqAccesos: false,
          reqPermisos: false,
          reqUniformes: false,
          reqHerramientas: false,
          reqNegativoDetails: "",
          reqPositivoDetails: "",
          evidenceFormat: "Estándar",
          serviceTypeRequired: [],
          responseTimeRequired: "",
          quoteReceiptEmail: "",
          contactoPrincipalIsActive: true,
          contactoPrincipal: { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
          contactoComprador: { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
          contactosSecundarios: [],
          regimenFiscal: "",
          usoCFDI: "",
          metodoPago: "",
          formaPago: "",
          diasCredito: 0,
          limiteCredito: 0,
          moneda: "MXN",
          datosFacturacionCompletos: "",
          correoFacturacion: "",
          contactoCuentasPorPagar: "",
          branches: [],
          changelog: [],
        }
    });

    const watchedBranches = form.watch("branches") || [];
    const watchedSecondaryContacts = form.watch("contactosSecundarios") || [];
    const watchedChangelog = form.watch("changelog") || [];

    useEffect(() => {
        if (isOpen) {
          if (client) {
            form.reset({
              ...client,
              clientType: client.clientType || "Persona moral",
              industry: client.industry || "Comercial",
              status: client.status || "Activo",
              assignedSeller: client.assignedSeller || "",
              priority: client.priority || "B",
              notes: client.notes || "",
              streetAndNumber: client.streetAndNumber || "",
              municipality: client.municipality || "",
              state: client.state || "",
              zipCode: client.zipCode || "",
              scheduleByDay: client.scheduleByDay || {},
              reqAccesos: client.reqAccesos || false,
              reqPermisos: client.reqPermisos || false,
              reqUniformes: client.reqUniformes || false,
              reqHerramientas: client.reqHerramientas || false,
              reqNegativoDetails: client.reqNegativoDetails || "",
              reqPositivoDetails: client.reqPositivoDetails || "",
              evidenceFormat: client.evidenceFormat || "Estándar",
              serviceTypeRequired: client.serviceTypeRequired || [],
              responseTimeRequired: client.responseTimeRequired || "",
              quoteReceiptEmail: client.quoteReceiptEmail || "",
              contactoPrincipalIsActive: client.contactoPrincipalIsActive !== undefined ? client.contactoPrincipalIsActive : true,
              contactoPrincipal: client.contactoPrincipal || { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
              contactoComprador: client.contactoComprador || { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
              contactosSecundarios: client.contactosSecundarios || [],
              regimenFiscal: client.regimenFiscal || "",
              usoCFDI: client.usoCFDI || "",
              metodoPago: client.metodoPago || "",
              formaPago: client.formaPago || "",
              diasCredito: client.diasCredito || 0,
              limiteCredito: client.limiteCredito || 0,
              moneda: client.moneda || "MXN",
              datosFacturacionCompletos: client.datosFacturacionCompletos || "",
              correoFacturacion: client.correoFacturacion || "",
              contactoCuentasPorPagar: client.contactoCuentasPorPagar || "",
              branches: client.branches || [],
              changelog: client.changelog || [],
            });
          } else {
            form.reset({
              name: "", 
              phone: "", 
              email: "", 
              address: "", 
              rfc: "",
              clientType: "Persona moral",
              industry: "Comercial",
              status: "Activo",
              assignedSeller: "",
              priority: "B",
              notes: "",
              streetAndNumber: "",
              municipality: "",
              state: "",
              zipCode: "",
              scheduleByDay: {},
              reqAccesos: false,
              reqPermisos: false,
              reqUniformes: false,
              reqHerramientas: false,
              reqNegativoDetails: "",
              reqPositivoDetails: "",
              evidenceFormat: "Estándar",
              serviceTypeRequired: [],
              responseTimeRequired: "",
              quoteReceiptEmail: "",
              contactoPrincipalIsActive: true,
              contactoPrincipal: { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
              contactoComprador: { name: "", puesto: "", depto: "", phoneDirect: "", celularWhatsapp: "", email: "" },
              contactosSecundarios: [],
              regimenFiscal: "",
              usoCFDI: "",
              metodoPago: "",
              formaPago: "",
              diasCredito: 0,
              limiteCredito: 0,
              moneda: "MXN",
              datosFacturacionCompletos: "",
              correoFacturacion: "",
              contactoCuentasPorPagar: "",
              branches: [],
              changelog: [],
            });
          }
          // Limpiar sub-formularios locales
          setBranchName("");
          setBranchStreet("");
          setBranchMuni("");
          setBranchState("");
          setBranchZip("");
          setSecName("");
          setSecPuesto("");
          setSecDepto("");
          setSecPhone("");
          setSecWhatsapp("");
          setSecEmail("");
        }
      }, [client, isOpen, form]);

    const handleSubmit = async (data: z.infer<typeof clientSchema>) => {
        setIsSubmitting(true);
        await onSave(data);
        setIsSubmitting(false);
    };

    // Agregar Sucursal Localmente
    const handleAddBranch = () => {
      if (!branchName) return;
      const bAddress = [branchStreet, branchMuni, branchState, branchZip ? `CP ${branchZip}` : ""].filter(Boolean).join(", ");
      const newBranch = {
        id: Math.random().toString(36).substring(2, 9),
        name: branchName,
        establishmentType: branchType,
        streetAndNumber: branchStreet,
        municipality: branchMuni,
        state: branchState,
        zipCode: branchZip,
        address: bAddress
      };
      form.setValue("branches", [...watchedBranches, newBranch]);
      // Limpiar campos
      setBranchName("");
      setBranchStreet("");
      setBranchMuni("");
      setBranchState("");
      setBranchZip("");
    };

    // Eliminar Sucursal Localmente
    const handleRemoveBranch = (id: string) => {
      form.setValue("branches", watchedBranches.filter(b => b.id !== id));
    };

    // Agregar Contacto Secundario Localmente
    const handleAddSecondaryContact = () => {
      if (!secName) return;
      const newContact = {
        name: secName,
        puesto: secPuesto,
        depto: secDepto,
        phoneDirect: secPhone,
        celularWhatsapp: secWhatsapp,
        email: secEmail
      };
      form.setValue("contactosSecundarios", [...watchedSecondaryContacts, newContact]);
      // Limpiar campos
      setSecName("");
      setSecPuesto("");
      setSecDepto("");
      setSecPhone("");
      setSecWhatsapp("");
      setSecEmail("");
    };

    // Eliminar Contacto Secundario Localmente
    const handleRemoveSecondaryContact = (index: number) => {
      form.setValue("contactosSecundarios", watchedSecondaryContacts.filter((_, i) => i !== index));
    };

    const daysOptions = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    const servicesOptions = ["Refrigeración", "Electricidad", "Obra Civil", "Voz y Datos", "Comercialización"];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6">
                <DialogHeader className="pb-2 border-b">
                    <DialogTitle className="text-2xl font-bold font-headline text-primary flex items-center gap-2">
                      {client ? <Edit className="w-6 h-6 text-primary" /> : <PlusCircle className="w-6 h-6 text-primary" />}
                      {client ? 'Editar Detalles del Cliente' : 'Agregar Nuevo Cliente Avanzado'}
                    </DialogTitle>
                    <DialogDescription>Completa todos los detalles organizados por pestañas.</DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 overflow-hidden flex flex-col space-y-4">
                        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
                            <TabsList className="grid w-full grid-cols-5 bg-[#EBF5FF] p-1 rounded-lg">
                                <TabsTrigger value="general" className="font-medium text-xs sm:text-sm py-2"><Briefcase className="w-4 h-4 mr-1.5" /> General</TabsTrigger>
                                <TabsTrigger value="branches" className="font-medium text-xs sm:text-sm py-2"><Building2 className="w-4 h-4 mr-1.5" /> Sucursales</TabsTrigger>
                                <TabsTrigger value="contacts" className="font-medium text-xs sm:text-sm py-2"><UserIcon className="w-4 h-4 mr-1.5" /> Contactos</TabsTrigger>
                                <TabsTrigger value="billing" className="font-medium text-xs sm:text-sm py-2"><CreditCard className="w-4 h-4 mr-1.5" /> Facturación</TabsTrigger>
                                <TabsTrigger value="history" className="font-medium text-xs sm:text-sm py-2"><History className="w-4 h-4 mr-1.5" /> Historial</TabsTrigger>
                            </TabsList>
                            
                            <div className="flex-1 overflow-y-auto max-h-[58vh] pr-2 p-2 mt-2 border rounded-md">
                                <div className="p-2 space-y-4">
                                  
                                    {/* ---------------- PESTAÑA GENERAL ---------------- */}
                                    <TabsContent value="general" className="space-y-4 outline-none">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="name" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Nombre o Razón Social *</FormLabel>
                                                    <FormControl><Input placeholder="Ej: STICS Industrial S.A. de C.V." {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="phone" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Teléfono de contacto *</FormLabel>
                                                    <FormControl><Input placeholder="Mínimo 10 dígitos" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <FormField control={form.control} name="clientType" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Tipo de Cliente</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona el tipo" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Persona física">Persona física</SelectItem>
                                                            <SelectItem value="Persona moral">Persona moral</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="industry" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Giro o Industria</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona giro" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Cliente residencial">Cliente residencial</SelectItem>
                                                            <SelectItem value="Comercial">Comercial</SelectItem>
                                                            <SelectItem value="Hotel">Hotel</SelectItem>
                                                            <SelectItem value="Casa">Casa</SelectItem>
                                                            <SelectItem value="Negocio">Negocio</SelectItem>
                                                            <SelectItem value="Otro">Otro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="status" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Estatus</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona estatus" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Activo">Activo</SelectItem>
                                                            <SelectItem value="Inactivo">Inactivo</SelectItem>
                                                            <SelectItem value="suspendido">Suspendido</SelectItem>
                                                            <SelectItem value="perdido">Perdido</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <FormField control={form.control} name="assignedSeller" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Vendedor Asignado</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Asignar vendedor" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {sellers.map((s) => (
                                                                <SelectItem key={s.uid} value={s.uid}>{s.displayName}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="priority" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Prioridad / Valor</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona prioridad" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="A">Alta (A)</SelectItem>
                                                            <SelectItem value="B">Media (B)</SelectItem>
                                                            <SelectItem value="C">Baja (C)</SelectItem>
                                                            <SelectItem value="D">Nula (D)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="evidenceFormat" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Formato de Evidencia</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Evidencia requerida" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="Estándar">Estándar</SelectItem>
                                                            <SelectItem value="Personal">Personalizado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="border-t pt-4">
                                            <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4" /> Dirección Desglosada</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField control={form.control} name="streetAndNumber" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Calle y Número</FormLabel>
                                                        <FormControl><Input placeholder="Ej: Av. Constitución #450" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="municipality" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Delegación o Municipio</FormLabel>
                                                        <FormControl><Input placeholder="Ej: Monterrey" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                                                <FormField control={form.control} name="state" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Estado</FormLabel>
                                                        <FormControl><Input placeholder="Ej: Nuevo León" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="zipCode" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Código Postal</FormLabel>
                                                        <FormControl><Input placeholder="Ej: 64000" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <div className="border-t pt-4">
                                            <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Días y Horarios de Atención</h4>
                                            <FormField control={form.control} name="scheduleByDay" render={({ field }) => {
                                                const schedule = field.value || {};
                                                const updateDay = (day: string, patch: Partial<{ enabled: boolean; open: string; close: string }>) => {
                                                    const current = schedule[day] || { enabled: false, open: '', close: '' };
                                                    field.onChange({ ...schedule, [day]: { ...current, ...patch } });
                                                };
                                                return (
                                                    <FormItem>
                                                        <div className="space-y-2">
                                                            {daysOptions.map(day => {
                                                                const dayData = schedule[day] || { enabled: false, open: '', close: '' };
                                                                return (
                                                                    <div key={day} className={`flex items-center gap-3 p-2 rounded-md border transition-colors ${
                                                                        dayData.enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-transparent'
                                                                    }`}>
                                                                        <div className="flex items-center gap-2 w-28 shrink-0">
                                                                            <Checkbox
                                                                                checked={dayData.enabled}
                                                                                onCheckedChange={(checked) => updateDay(day, { enabled: !!checked })}
                                                                            />
                                                                            <span className={`text-sm font-medium ${dayData.enabled ? 'text-foreground' : 'text-muted-foreground'}`}>{day}</span>
                                                                        </div>
                                                                        {dayData.enabled && (
                                                                            <div className="flex items-center gap-2 flex-1">
                                                                                <Input
                                                                                    type="time"
                                                                                    value={dayData.open || ''}
                                                                                    onChange={(e) => updateDay(day, { open: e.target.value })}
                                                                                    className="h-8 w-32 text-xs"
                                                                                />
                                                                                <span className="text-xs text-muted-foreground">a</span>
                                                                                <Input
                                                                                    type="time"
                                                                                    value={dayData.close || ''}
                                                                                    onChange={(e) => updateDay(day, { close: e.target.value })}
                                                                                    className="h-8 w-32 text-xs"
                                                                                />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                );
                                            }} />
                                        </div>

                                        <div className="border-t pt-4">
                                            <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Requisitos de Ingresos</h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                <FormField control={form.control} name="reqAccesos" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="text-xs cursor-pointer">Accesos</FormLabel>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="reqPermisos" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="text-xs cursor-pointer">Permisos Especiales</FormLabel>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="reqUniformes" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="text-xs cursor-pointer">Uniformes específicos</FormLabel>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="reqHerramientas" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="text-xs cursor-pointer">Herramientas Certificadas</FormLabel>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <FormField control={form.control} name="reqPositivoDetails" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Requisitos Positivos (Lo necesario)</FormLabel>
                                                        <FormControl><Textarea rows={2} placeholder="Ej: Portar EPP completo, credencial vigente..." {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="reqNegativoDetails" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Requisitos Negativos (Lo prohibido)</FormLabel>
                                                        <FormControl><Textarea rows={2} placeholder="Ej: No introducir celulares con cámara, no herramientas sin marca..." {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <div className="border-t pt-4">
                                            <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Especificaciones de Servicio</h4>
                                            <div className="mb-3">
                                                <FormLabel className="text-xs font-semibold block mb-1">Tipos de Servicio Requeridos</FormLabel>
                                                <div className="flex flex-wrap gap-4">
                                                    {servicesOptions.map(srv => (
                                                        <FormField
                                                            key={srv}
                                                            control={form.control}
                                                            name="serviceTypeRequired"
                                                            render={({ field }) => (
                                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                                    <FormControl>
                                                                        <Checkbox
                                                                            checked={field.value?.includes(srv)}
                                                                            onCheckedChange={(checked) => {
                                                                                const updated = checked 
                                                                                    ? [...field.value, srv]
                                                                                    : field.value.filter(s => s !== srv);
                                                                                field.onChange(updated);
                                                                            }}
                                                                        />
                                                                    </FormControl>
                                                                    <FormLabel className="text-xs cursor-pointer">{srv}</FormLabel>
                                                                </FormItem>
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <FormField control={form.control} name="email" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Correo del Cliente</FormLabel>
                                                        <FormControl><Input placeholder="correo@empresa.com" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="quoteReceiptEmail" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Correo Recepción Cotizaciones</FormLabel>
                                                        <FormControl><Input placeholder="cotizaciones@empresa.com" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="responseTimeRequired" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Tiempo de Respuesta Comprometido</FormLabel>
                                                        <FormControl><Input placeholder="Ej: 4 horas" {...field} /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        <FormField control={form.control} name="notes" render={({ field }) => (
                                            <FormItem className="border-t pt-4">
                                                <FormLabel className="font-semibold">Notas Generales</FormLabel>
                                                <FormControl><Textarea rows={3} placeholder="Anotaciones extra sobre el cliente o negociaciones..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </TabsContent>

                                    {/* ---------------- PESTAÑA SUCURSALES ---------------- */}
                                    <TabsContent value="branches" className="space-y-4 outline-none">
                                        <div className="bg-[#EBF5FF] p-4 rounded-md border border-blue-200">
                                            <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5"><Building className="w-4 h-4 text-primary" /> Registrar Nueva Sucursal / Subregistro</h4>
                                            <p className="text-xs text-muted-foreground mb-4">Introduce los datos para sucursales hijas (por ejemplo, tiendas físicas o bodegas del cliente primario).</p>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Nombre de Establecimiento *</label>
                                                    <Input size={30} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Ej: Tienda AKI Centro" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Tipo de Establecimiento</label>
                                                    <Select onValueChange={setBranchType} value={branchType}>
                                                        <SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona tipo" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sucursal">Sucursal</SelectItem>
                                                            <SelectItem value="Tienda">Tienda</SelectItem>
                                                            <SelectItem value="Almacén/Bodega">Almacén/Bodega</SelectItem>
                                                            <SelectItem value="Oficina Administrativa">Oficina Administrativa</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Calle y Número</label>
                                                    <Input value={branchStreet} onChange={(e) => setBranchStreet(e.target.value)} placeholder="Ej: Benito Juárez #302" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Municipio o Delegación</label>
                                                    <Input value={branchMuni} onChange={(e) => setBranchMuni(e.target.value)} placeholder="Ej: San Pedro" className="bg-white" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Estado</label>
                                                    <Input value={branchState} onChange={(e) => setBranchState(e.target.value)} placeholder="Ej: Nuevo León" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Código Postal</label>
                                                    <Input value={branchZip} onChange={(e) => setBranchZip(e.target.value)} placeholder="Ej: 66200" className="bg-white" />
                                                </div>
                                            </div>

                                            <Button type="button" onClick={handleAddBranch} className="mt-4 w-full bg-primary hover:bg-primary/95 text-white" disabled={!branchName}>
                                                <PlusCircle className="w-4 h-4 mr-2" /> Agregar a Lista de Sucursales
                                            </Button>
                                        </div>

                                        <div className="mt-4 border rounded-md">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nombre</TableHead>
                                                        <TableHead>Tipo</TableHead>
                                                        <TableHead>Dirección Completa</TableHead>
                                                        <TableHead className="w-12"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {watchedBranches.length > 0 ? (
                                                        watchedBranches.map((b) => (
                                                            <TableRow key={b.id}>
                                                                <TableCell className="font-semibold text-xs">{b.name}</TableCell>
                                                                <TableCell className="text-xs"><Badge variant="secondary">{b.establishmentType}</Badge></TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{b.address}</TableCell>
                                                                <TableCell>
                                                                    <Button size="icon" variant="ghost" onClick={() => handleRemoveBranch(b.id)} className="h-7 w-7 text-red-500 hover:text-red-700">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                                                                Este cliente no tiene sucursales adicionales vinculadas aún.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>

                                    {/* ---------------- PESTAÑA CONTACTOS ---------------- */}
                                    <TabsContent value="contacts" className="space-y-4 outline-none">
                                        
                                        {/* Contacto Principal */}
                                        <div className="border p-4 rounded-md bg-white shadow-sm space-y-3">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <h4 className="font-bold text-sm text-primary flex items-center gap-1.5"><UserIcon className="w-4 h-4 text-primary" /> Contacto Principal</h4>
                                                <FormField control={form.control} name="contactoPrincipalIsActive" render={({ field }) => (
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                        <FormLabel className="text-xs">¿Contacto Principal Activo?</FormLabel>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <FormField control={form.control} name="contactoPrincipal.name" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Ing. Carlos Ruiz" {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoPrincipal.puesto" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Puesto</FormLabel><FormControl><Input placeholder="Ej: Gerente de Mantenimiento" {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoPrincipal.depto" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Departamento</FormLabel><FormControl><Input placeholder="Ej: Operaciones" {...field} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <FormField control={form.control} name="contactoPrincipal.phoneDirect" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Teléfono Directo</FormLabel><FormControl><Input placeholder="Directo / Ext." {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoPrincipal.celularWhatsapp" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Celular / WhatsApp</FormLabel><FormControl><Input placeholder="Ej: 811..." {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoPrincipal.email" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="carlos@empresa.com" {...field} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        {/* Contacto Comprador */}
                                        <div className="border p-4 rounded-md bg-white shadow-sm space-y-3">
                                            <h4 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-primary" /> Contacto Comprador</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <FormField control={form.control} name="contactoComprador.name" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Nombre Completo</FormLabel><FormControl><Input placeholder="Ej: Lic. Ana Martínez" {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoComprador.puesto" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Puesto</FormLabel><FormControl><Input placeholder="Ej: Compras y Adquisiciones" {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoComprador.depto" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Departamento</FormLabel><FormControl><Input placeholder="Ej: Finanzas" {...field} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <FormField control={form.control} name="contactoComprador.phoneDirect" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Teléfono Directo</FormLabel><FormControl><Input placeholder="Directo / Ext." {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoComprador.celularWhatsapp" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Celular / WhatsApp</FormLabel><FormControl><Input placeholder="Ej: 812..." {...field} /></FormControl></FormItem>
                                                )} />
                                                <FormField control={form.control} name="contactoComprador.email" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-xs">Correo Electrónico</FormLabel><FormControl><Input type="email" placeholder="compras@empresa.com" {...field} /></FormControl></FormItem>
                                                )} />
                                            </div>
                                        </div>

                                        {/* Contactos Secundarios Adicionales */}
                                        <div className="border p-4 rounded-md bg-[#EBF5FF] shadow-sm space-y-3">
                                            <h4 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5"><PlusCircle className="w-4 h-4 text-primary" /> Agregar Contacto Secundario</h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Nombre Completo</label>
                                                    <Input value={secName} onChange={(e) => setSecName(e.target.value)} placeholder="Nombre del contacto" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Puesto</label>
                                                    <Input value={secPuesto} onChange={(e) => setSecPuesto(e.target.value)} placeholder="Ej: Supervisor" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Departamento</label>
                                                    <Input value={secDepto} onChange={(e) => setSecDepto(e.target.value)} placeholder="Ej: Planta" className="bg-white" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Teléfono Directo</label>
                                                    <Input value={secPhone} onChange={(e) => setSecPhone(e.target.value)} placeholder="Directo" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Celular / WhatsApp</label>
                                                    <Input value={secWhatsapp} onChange={(e) => setSecWhatsapp(e.target.value)} placeholder="Celular" className="bg-white" />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-semibold block mb-1">Correo Electrónico</label>
                                                    <Input value={secEmail} onChange={(e) => setSecEmail(e.target.value)} type="email" placeholder="correo@empresa.com" className="bg-white" />
                                                </div>
                                            </div>

                                            <Button type="button" onClick={handleAddSecondaryContact} className="mt-2 w-full text-white bg-primary" disabled={!secName}>
                                                <PlusCircle className="w-4 h-4 mr-2" /> Añadir Contacto Secundario
                                            </Button>
                                        </div>

                                        <div className="mt-4 border rounded-md bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Nombre</TableHead>
                                                        <TableHead>Puesto / Depto</TableHead>
                                                        <TableHead>Datos de Contacto</TableHead>
                                                        <TableHead className="w-12"></TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {watchedSecondaryContacts.length > 0 ? (
                                                        watchedSecondaryContacts.map((contact, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="font-semibold text-xs">{contact.name}</TableCell>
                                                                <TableCell className="text-xs">{contact.puesto || "N/A"} - <span className="text-muted-foreground">{contact.depto || "N/A"}</span></TableCell>
                                                                <TableCell className="text-xs">
                                                                    <div className="flex flex-col">
                                                                        {contact.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground"/> {contact.email}</span>}
                                                                        {contact.celularWhatsapp && <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground"/> {contact.celularWhatsapp}</span>}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button size="icon" variant="ghost" onClick={() => handleRemoveSecondaryContact(index)} className="h-7 w-7 text-red-500">
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">
                                                                No se han agregado contactos secundarios a este cliente.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>

                                    {/* ---------------- PESTAÑA FACTURACIÓN ---------------- */}
                                    <TabsContent value="billing" className="space-y-4 outline-none">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="rfc" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">RFC</FormLabel>
                                                    <FormControl><Input placeholder="Registro Federal de Contribuyentes" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="regimenFiscal" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Régimen Fiscal</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona régimen fiscal" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="601 - General de Ley Personas Morales">601 - General de Ley Personas Morales</SelectItem>
                                                            <SelectItem value="603 - Personas Morales con Fines no Lucrativos">603 - Personas Morales con Fines no Lucrativos</SelectItem>
                                                            <SelectItem value="605 - Sueldos y Salarios e Ingresos Asimilados a Salarios">605 - Sueldos y Salarios e Ingresos Asimilados a Salarios</SelectItem>
                                                            <SelectItem value="606 - Arrendamiento">606 - Arrendamiento</SelectItem>
                                                            <SelectItem value="607 - Régimen de Enajenación o Adquisición de Bienes">607 - Régimen de Enajenación o Adquisición de Bienes</SelectItem>
                                                            <SelectItem value="608 - Demás ingresos">608 - Demás ingresos</SelectItem>
                                                            <SelectItem value="610 - Residentes en el Extranjero sin Establecimiento Permanente en México">610 - Residentes en el Extranjero sin EP en México</SelectItem>
                                                            <SelectItem value="611 - Ingresos por Dividendos (socios y accionistas)">611 - Ingresos por Dividendos (socios y accionistas)</SelectItem>
                                                            <SelectItem value="612 - Personas Físicas con Actividades Empresariales y Profesionales">612 - Personas Físicas con Act. Empresariales y Profesionales</SelectItem>
                                                            <SelectItem value="614 - Ingresos por intereses">614 - Ingresos por intereses</SelectItem>
                                                            <SelectItem value="615 - Régimen de los ingresos por obtención de premios">615 - Régimen de los ingresos por obtención de premios</SelectItem>
                                                            <SelectItem value="616 - Sin obligaciones fiscales">616 - Sin obligaciones fiscales</SelectItem>
                                                            <SelectItem value="620 - Sociedades Cooperativas de Producción">620 - Sociedades Cooperativas de Producción</SelectItem>
                                                            <SelectItem value="621 - Incorporación Fiscal">621 - Incorporación Fiscal</SelectItem>
                                                            <SelectItem value="622 - Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras">622 - Act. Agrícolas, Ganaderas, Silvícolas y Pesqueras</SelectItem>
                                                            <SelectItem value="623 - Opcional para Grupos de Sociedades">623 - Opcional para Grupos de Sociedades</SelectItem>
                                                            <SelectItem value="624 - Coordinados">624 - Coordinados</SelectItem>
                                                            <SelectItem value="625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas">625 - Act. Empresariales con Plataformas Tecnológicas</SelectItem>
                                                            <SelectItem value="626 - Régimen Simplificado de Confianza">626 - Régimen Simplificado de Confianza</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="usoCFDI" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Uso de CFDI</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona uso de CFDI" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="G01 - Adquisición de mercancías">G01 - Adquisición de mercancías</SelectItem>
                                                            <SelectItem value="G02 - Devoluciones, descuentos o bonificaciones">G02 - Devoluciones, descuentos o bonificaciones</SelectItem>
                                                            <SelectItem value="G03 - Gastos en general">G03 - Gastos en general</SelectItem>
                                                            <SelectItem value="I01 - Construcciones">I01 - Construcciones</SelectItem>
                                                            <SelectItem value="I02 - Mobiliario y equipo de oficina por inversiones">I02 - Mobiliario y equipo de oficina por inversiones</SelectItem>
                                                            <SelectItem value="I03 - Equipo de transporte">I03 - Equipo de transporte</SelectItem>
                                                            <SelectItem value="I04 - Equipo de cómputo y accesorios">I04 - Equipo de cómputo y accesorios</SelectItem>
                                                            <SelectItem value="I05 - Dados, troqueles, moldes, matrices y herramental">I05 - Dados, troqueles, moldes, matrices y herramental</SelectItem>
                                                            <SelectItem value="I06 - Comunicaciones telefónicas">I06 - Comunicaciones telefónicas</SelectItem>
                                                            <SelectItem value="I07 - Comunicaciones satelitales">I07 - Comunicaciones satelitales</SelectItem>
                                                            <SelectItem value="I08 - Otra maquinaria y equipo">I08 - Otra maquinaria y equipo</SelectItem>
                                                            <SelectItem value="D01 - Honorarios médicos, dentales y gastos hospitalarios">D01 - Honorarios médicos, dentales y gastos hospitalarios</SelectItem>
                                                            <SelectItem value="D02 - Gastos médicos por incapacidad o discapacidad">D02 - Gastos médicos por incapacidad o discapacidad</SelectItem>
                                                            <SelectItem value="D03 - Gastos funerales">D03 - Gastos funerales</SelectItem>
                                                            <SelectItem value="D04 - Donativos">D04 - Donativos</SelectItem>
                                                            <SelectItem value="D05 - Intereses reales efectivamente pagados por créditos hipotecarios (casa habitación)">D05 - Intereses reales por créditos hipotecarios</SelectItem>
                                                            <SelectItem value="D06 - Aportaciones voluntarias al SAR">D06 - Aportaciones voluntarias al SAR</SelectItem>
                                                            <SelectItem value="D07 - Primas por seguros de gastos médicos">D07 - Primas por seguros de gastos médicos</SelectItem>
                                                            <SelectItem value="D08 - Gastos de transportación escolar obligatoria">D08 - Gastos de transportación escolar obligatoria</SelectItem>
                                                            <SelectItem value="D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones">D09 - Depósitos en cuentas para el ahorro / pensiones</SelectItem>
                                                            <SelectItem value="D10 - Pagos por servicios educativos (colegiaturas)">D10 - Pagos por servicios educativos (colegiaturas)</SelectItem>
                                                            <SelectItem value="S01 - Sin efectos fiscales">S01 - Sin efectos fiscales</SelectItem>
                                                            <SelectItem value="CP01 - Pagos">CP01 - Pagos</SelectItem>
                                                            <SelectItem value="CN01 - Nómina">CN01 - Nómina</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="metodoPago" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Método de Pago</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona método" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="PPD - Pago en parcialidades o diferido">PPD - Pago en parcialidades o diferido</SelectItem>
                                                            <SelectItem value="PUE - Pago en una sola exhibición">PUE - Pago en una sola exhibición</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField control={form.control} name="formaPago" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Forma de Pago</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona forma de pago" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="01 - Efectivo">01 - Efectivo</SelectItem>
                                                            <SelectItem value="02 - Cheque nominativo">02 - Cheque nominativo</SelectItem>
                                                            <SelectItem value="03 - Transferencia electrónica de fondos">03 - Transferencia electrónica de fondos</SelectItem>
                                                            <SelectItem value="04 - Tarjeta de crédito">04 - Tarjeta de crédito</SelectItem>
                                                            <SelectItem value="05 - Monedero electrónico">05 - Monedero electrónico</SelectItem>
                                                            <SelectItem value="06 - Dinero electrónico">06 - Dinero electrónico</SelectItem>
                                                            <SelectItem value="08 - Vales de despensa">08 - Vales de despensa</SelectItem>
                                                            <SelectItem value="12 - Dación en pago">12 - Dación en pago</SelectItem>
                                                            <SelectItem value="13 - Pago por subrogación">13 - Pago por subrogación</SelectItem>
                                                            <SelectItem value="14 - Pago por consignación">14 - Pago por consignación</SelectItem>
                                                            <SelectItem value="15 - Condonación">15 - Condonación</SelectItem>
                                                            <SelectItem value="17 - Compensación">17 - Compensación</SelectItem>
                                                            <SelectItem value="23 - Novación">23 - Novación</SelectItem>
                                                            <SelectItem value="24 - Confusión">24 - Confusión</SelectItem>
                                                            <SelectItem value="25 - Remisión de deuda">25 - Remisión de deuda</SelectItem>
                                                            <SelectItem value="26 - Prescripción o caducidad">26 - Prescripción o caducidad</SelectItem>
                                                            <SelectItem value="27 - A satisfacción del acreedor">27 - A satisfacción del acreedor</SelectItem>
                                                            <SelectItem value="28 - Tarjeta de débito">28 - Tarjeta de débito</SelectItem>
                                                            <SelectItem value="29 - Tarjeta de servicios">29 - Tarjeta de servicios</SelectItem>
                                                            <SelectItem value="30 - Aplicación de anticipos">30 - Aplicación de anticipos</SelectItem>
                                                            <SelectItem value="31 - Intermediario pagos">31 - Intermediario pagos</SelectItem>
                                                            <SelectItem value="99 - Por definir">99 - Por definir</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="moneda" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Moneda habitual</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Selecciona Moneda" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="MXN">MXN (Pesos Mexicanos)</SelectItem>
                                                            <SelectItem value="USD">USD (Dólares)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                                            <FormField control={form.control} name="diasCredito" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Días de Crédito</FormLabel>
                                                    <FormControl><Input type="number" placeholder="Ej: 30" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="limiteCredito" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Límite de Crédito ($)</FormLabel>
                                                    <FormControl><Input type="number" placeholder="Ej: 100000" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormField control={form.control} name="correoFacturacion" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Correo de Facturación</FormLabel>
                                                    <FormControl><Input type="email" placeholder="facturas@empresa.com" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                            <FormField control={form.control} name="contactoCuentasPorPagar" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-semibold">Contacto de Cuentas por Pagar</FormLabel>
                                                    <FormControl><Input placeholder="Nombre o extensión de CxP" {...field} /></FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )} />

                                            <FormItem>
                                                <FormLabel className="font-semibold">Documentos Fiscales Adjuntos</FormLabel>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input type="file" disabled className="bg-gray-50 border-dashed text-muted-foreground text-xs" />
                                                    <Badge variant="outline" className="h-9 px-2 text-xs border-dashed text-orange-600 bg-orange-50 border-orange-200 flex items-center gap-1 whitespace-nowrap">
                                                        <AlertTriangle className="w-3.5 h-3.5" /> En Desarrollo
                                                    </Badge>
                                                </div>
                                                <FormDescription className="text-[10px]">Carga de PDF de Constancia de Situación Fiscal o similar.</FormDescription>
                                            </FormItem>
                                        </div>

                                        <FormField control={form.control} name="datosFacturacionCompletos" render={({ field }) => (
                                            <FormItem className="border-t pt-4">
                                                <FormLabel className="font-semibold">Datos Completos de Facturación (Texto libre)</FormLabel>
                                                <FormControl><Textarea rows={3} placeholder="Dirección fiscal, CP fiscal y cualquier especificación especial de facturación..." {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    </TabsContent>

                                    {/* ---------------- PESTAÑA HISTORIAL ---------------- */}
                                    <TabsContent value="history" className="space-y-4 outline-none">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-blue-50 border border-blue-200 p-3 rounded-md mb-2">
                                            <History className="w-4 h-4 text-primary shrink-0" />
                                            <span>Esta bitácora de auditoría registra de forma automática los eventos y cambios de información de esta cuenta.</span>
                                        </div>
                                        
                                        <div className="border rounded-md bg-white">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-[150px]">Fecha</TableHead>
                                                        <TableHead className="w-[100px]">Tipo</TableHead>
                                                        <TableHead className="w-[150px]">Autor</TableHead>
                                                        <TableHead>Detalle de Cambios</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {watchedChangelog.length > 0 ? (
                                                        watchedChangelog.map((log, index) => (
                                                            <TableRow key={index}>
                                                                <TableCell className="text-xs font-medium">{new Date(log.timestamp).toLocaleString("es-MX")}</TableCell>
                                                                <TableCell className="text-xs">
                                                                    <Badge variant={log.changeType === "Creación" ? "default" : "secondary"}>
                                                                        {log.changeType}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{log.userName}</TableCell>
                                                                <TableCell className="text-xs font-medium text-slate-800">{log.details}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                                                                No hay registros históricos aún en esta cuenta. Los cambios se guardarán automáticamente a partir de la próxima actualización.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </TabsContent>
                                </div>
                            </div>
                        </Tabs>

                        <DialogFooter className="border-t pt-4 flex gap-2">
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/95 text-white">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {client ? 'Guardar Cambios' : 'Crear Cliente'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// ─── DIALOG DE VISUALIZACIÓN ─────────────────────────────────────────────────
interface ClientViewDialogProps {
  client: Client | null;
  sellers: { uid: string; displayName: string; email: string }[];
  onClose: () => void;
  onEdit: (client: Client) => void;
}

function ClientViewDialog({ client, sellers, onClose, onEdit }: ClientViewDialogProps) {
  if (!client) return null;

  const daysOptions = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const schedule = (client as any).scheduleByDay || {};

  const resolveSellerName = (sellerId?: string) => {
    if (!sellerId) return undefined;
    const seller = sellers.find(s => s.uid === sellerId);
    return seller ? seller.displayName : sellerId;
  };

  const statusStyles: Record<string, string> = {
    "Activo": "bg-emerald-100 text-emerald-800 border-emerald-300",
    "Inactivo": "bg-slate-100 text-slate-600 border-slate-300",
    "suspendido": "bg-amber-100 text-amber-800 border-amber-300",
    "perdido": "bg-red-100 text-red-700 border-red-300"
  };

  const priorityMap: Record<string, { label: string, dot: string }> = {
    "A": { label: "Alta", dot: "bg-red-500" },
    "B": { label: "Media", dot: "bg-amber-500" },
    "C": { label: "Baja", dot: "bg-blue-500" },
    "D": { label: "Nula", dot: "bg-slate-400" }
  };

  const resolvedPriority = priorityMap[client.priority || "B"] || { label: "Media", dot: "bg-amber-500" };
  const hasNotes = client.notes && client.notes.trim() !== "" && client.notes.toLowerCase() !== "ninguno";
  const hasRequisitos = client.reqAccesos || client.reqPermisos || client.reqUniformes || client.reqHerramientas || client.reqNegativoDetails || client.reqPositivoDetails;
  const contactosSecundarios = client.contactosSecundarios || [];
  const hasSchedule = Object.keys(schedule).some((d: string) => schedule[d]?.enabled);
  const hasService = (client.serviceTypeRequired?.length > 0 || client.responseTimeRequired || client.evidenceFormat || client.quoteReceiptEmail || client.email);
  const changelog = client.changelog || [];

  const InfoField = ({ label, value }: { label: string; value?: React.ReactNode }) => {
    if (value === undefined || value === null || value === "") return null;
    return (
      <div className="space-y-1">
        <span className="text-xs font-semibold text-muted-foreground block">{label}</span>
        <div className="text-sm font-medium text-slate-900 break-words">{value}</div>
      </div>
    );
  };

  const ContactBlock = ({ title, data }: { title: string; data: any }) => {
    if (!data || !data.name) return null;
    return (
      <div className="rounded-md border p-4 bg-white shadow-sm space-y-3">
        <h4 className="font-bold text-sm text-primary border-b pb-2 flex items-center gap-1.5">{title}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InfoField label="Nombre Completo" value={data.name} />
          <InfoField label="Puesto" value={data.puesto} />
          <InfoField label="Departamento" value={data.depto} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <InfoField label="Teléfono Directo" value={data.phoneDirect} />
          <InfoField label="Celular / WhatsApp" value={data.celularWhatsapp} />
          <InfoField label="Correo Electrónico" value={data.email} />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={!!client} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <DialogTitle className="text-2xl font-bold font-headline text-primary flex items-center gap-2">
              <Building className="w-6 h-6 text-primary" />
              {client.name}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusStyles[client.status || "Activo"]} text-[11px] font-semibold px-2.5 py-0.5`}>
                {client.status || "Activo"}
              </Badge>
              <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 border border-slate-200">
                <div className={`w-2 h-2 rounded-full ${resolvedPriority.dot}`}></div>
                <span className="text-[11px] text-slate-700 font-medium">Prioridad {resolvedPriority.label}</span>
              </div>
              {client.clientType && (
                <Badge variant="outline" className="text-[11px] font-semibold px-2.5 py-0.5">
                  {client.clientType}
                </Badge>
              )}
            </div>
          </div>
          <DialogDescription className="sr-only">Detalles del cliente {client.name}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden mt-4">
          <TabsList className="grid w-full grid-cols-5 bg-[#EBF5FF] p-1 rounded-lg">
            <TabsTrigger value="general" className="font-medium text-xs sm:text-sm py-2">
              <Briefcase className="w-4 h-4 mr-1.5" /> General
            </TabsTrigger>
            <TabsTrigger value="branches" className="font-medium text-xs sm:text-sm py-2">
              <Building2 className="w-4 h-4 mr-1.5" /> Sucursales
            </TabsTrigger>
            <TabsTrigger value="contacts" className="font-medium text-xs sm:text-sm py-2">
              <UserIcon className="w-4 h-4 mr-1.5" /> Contactos
            </TabsTrigger>
            <TabsTrigger value="billing" className="font-medium text-xs sm:text-sm py-2">
              <CreditCard className="w-4 h-4 mr-1.5" /> Facturación
            </TabsTrigger>
            <TabsTrigger value="history" className="font-medium text-xs sm:text-sm py-2">
              <History className="w-4 h-4 mr-1.5" /> Historial
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto max-h-[58vh] pr-2 p-2 mt-2 border rounded-md">
            <div className="p-2 space-y-6">

              {/* ---------------- PESTAÑA GENERAL ---------------- */}
              <TabsContent value="general" className="space-y-6 outline-none mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Teléfono de contacto" value={client.phone} />
                  <InfoField label="Correo electrónico" value={client.email} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                  <InfoField label="Giro o Industria" value={client.industry} />
                  <InfoField label="RFC" value={client.rfc} />
                  <InfoField label="Vendedor Asignado" value={resolveSellerName(client.assignedSeller)} />
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" /> Dirección Desglosada
                  </h4>
                  {(client.streetAndNumber || client.municipality || client.state || client.zipCode) ? (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50/50 p-3 rounded-md border">
                      <InfoField label="Calle y Número" value={client.streetAndNumber} />
                      <InfoField label="Municipio o Delegación" value={client.municipality} />
                      <InfoField label="Estado" value={client.state} />
                      <InfoField label="Código Postal" value={client.zipCode} />
                    </div>
                  ) : (
                    <div className="text-sm font-medium text-slate-900 bg-slate-50/50 p-3 rounded-md border">
                      {client.address || "Sin dirección registrada"}
                    </div>
                  )}
                </div>

                {hasSchedule && (
                  <div className="border-t pt-4">
                    <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-primary" /> Días y Horarios de Atención
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-md border">
                      {daysOptions.map(day => {
                        const dayData = schedule[day];
                        if (!dayData?.enabled) return null;
                        return (
                          <div key={day} className="flex items-center justify-between p-2 rounded bg-white border">
                            <span className="text-sm font-semibold text-slate-700">{day}</span>
                            <span className="text-sm text-slate-600 font-medium tabular-nums">
                              {dayData.open || "--:--"} a {dayData.close || "--:--"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {hasRequisitos && (
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-primary" /> Requisitos de Ingresos
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {client.reqAccesos && <Badge variant="outline" className="text-xs font-medium bg-blue-50 text-blue-700 border-blue-200">🔑 Accesos</Badge>}
                      {client.reqPermisos && <Badge variant="outline" className="text-xs font-medium bg-purple-50 text-purple-700 border-purple-200">📋 Permisos Especiales</Badge>}
                      {client.reqUniformes && <Badge variant="outline" className="text-xs font-medium bg-orange-50 text-orange-700 border-orange-200">👔 Uniformes específicos</Badge>}
                      {client.reqHerramientas && <Badge variant="outline" className="text-xs font-medium bg-green-50 text-green-700 border-green-200">🔧 Herramientas Certificadas</Badge>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      {client.reqPositivoDetails && (
                        <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
                          <span className="text-xs font-bold text-emerald-700 block mb-1">✅ Requisitos Positivos (Lo necesario)</span>
                          <p className="text-xs text-emerald-800 font-medium whitespace-pre-wrap">{client.reqPositivoDetails}</p>
                        </div>
                      )}
                      {client.reqNegativoDetails && (
                        <div className="bg-red-50/50 rounded-lg p-3 border border-red-100">
                          <span className="text-xs font-bold text-red-700 block mb-1">⛔ Requisitos Negativos (Lo prohibido)</span>
                          <p className="text-xs text-red-800 font-medium whitespace-pre-wrap">{client.reqNegativoDetails}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {hasService && (
                  <div className="border-t pt-4">
                    <h4 className="font-bold text-sm text-primary mb-2 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" /> Especificaciones de Servicio
                    </h4>
                    <div className="bg-slate-50/50 p-3 rounded-md border space-y-4">
                      {client.serviceTypeRequired?.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-muted-foreground block mb-1.5">Tipos de Servicio Requeridos</span>
                          <div className="flex flex-wrap gap-2">
                            {client.serviceTypeRequired.map((srv: string) => (
                              <Badge key={srv} variant="secondary" className="text-xs font-medium">{srv}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-3">
                        <InfoField label="Correo del Cliente" value={client.email} />
                        <InfoField label="Correo Recepción Cotizaciones" value={client.quoteReceiptEmail} />
                        <InfoField label="Tiempo de Respuesta Comprometido" value={client.responseTimeRequired} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-3">
                        <InfoField label="Formato de Evidencia" value={client.evidenceFormat} />
                      </div>
                    </div>
                  </div>
                )}

                {hasNotes && (
                  <div className="border-t pt-4">
                    <span className="text-xs font-semibold text-muted-foreground block mb-1">Notas Generales</span>
                    <div className="text-sm font-medium text-slate-900 bg-slate-50/50 p-3 rounded-md border whitespace-pre-wrap">
                      {client.notes}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* ---------------- PESTAÑA SUCURSALES ---------------- */}
              <TabsContent value="branches" className="space-y-4 outline-none mt-0">
                {client.branches && client.branches.length > 0 ? (
                  <div className="border rounded-md bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Dirección Completa</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {client.branches.map((b, i) => (
                          <TableRow key={b.id || i}>
                            <TableCell className="font-semibold text-xs text-slate-800">{b.name}</TableCell>
                            <TableCell className="text-xs"><Badge variant="secondary">{b.establishmentType || "Sucursal"}</Badge></TableCell>
                            <TableCell className="text-xs text-slate-600">{b.address}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-md bg-slate-50/50">
                    Este cliente no tiene sucursales adicionales vinculadas aún.
                  </div>
                )}
              </TabsContent>

              {/* ---------------- PESTAÑA CONTACTOS ---------------- */}
              <TabsContent value="contacts" className="space-y-4 outline-none mt-0">
                <ContactBlock title="Contacto Principal" data={client.contactoPrincipal} />
                <ContactBlock title="Contacto Comprador" data={client.contactoComprador} />

                {contactosSecundarios.length > 0 ? (
                  <div className="space-y-3 mt-4">
                    <span className="text-xs font-semibold text-muted-foreground block">Contactos Secundarios</span>
                    <div className="border rounded-md bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Puesto / Depto</TableHead>
                            <TableHead>Datos de Contacto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contactosSecundarios.map((contact, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-semibold text-xs text-slate-800">{contact.name}</TableCell>
                              <TableCell className="text-xs">{contact.puesto || "N/A"} - <span className="text-muted-foreground">{contact.depto || "N/A"}</span></TableCell>
                              <TableCell className="text-xs">
                                <div className="flex flex-col gap-0.5">
                                  {contact.email && <span>{contact.email}</span>}
                                  {contact.phoneDirect && <span className="text-[11px] text-muted-foreground">Tel: {contact.phoneDirect}</span>}
                                  {contact.celularWhatsapp && <span className="text-[11px] text-muted-foreground">WhatsApp: {contact.celularWhatsapp}</span>}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                ) : null}

                {!client.contactoPrincipal?.name && !client.contactoComprador?.name && contactosSecundarios.length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-md bg-slate-50/50">
                    No se han registrado contactos en esta cuenta aún.
                  </div>
                )}
              </TabsContent>

              {/* ---------------- PESTAÑA FACTURACIÓN ---------------- */}
              <TabsContent value="billing" className="space-y-6 outline-none mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="RFC" value={client.rfc} />
                  <InfoField label="Régimen Fiscal" value={client.regimenFiscal} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <InfoField label="Uso de CFDI" value={client.usoCFDI} />
                  <InfoField label="Método de Pago" value={client.metodoPago} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <InfoField label="Forma de Pago" value={client.formaPago} />
                  <InfoField label="Moneda habitual" value={client.moneda} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t pt-4">
                  <InfoField label="Días de Crédito" value={client.diasCredito ? `${client.diasCredito} días` : undefined} />
                  <InfoField label="Límite de Crédito" value={client.limiteCredito ? `$${client.limiteCredito.toLocaleString('es-MX')}` : undefined} />
                  <InfoField label="Correo de Facturación" value={client.correoFacturacion} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                  <InfoField label="Contacto de Cuentas por Pagar" value={client.contactoCuentasPorPagar} />
                </div>

                {client.datosFacturacionCompletos && (
                  <div className="border-t pt-4">
                    <InfoField label="Datos Completos de Facturación" value={client.datosFacturacionCompletos} />
                  </div>
                )}
              </TabsContent>

              {/* ---------------- PESTAÑA HISTORIAL ---------------- */}
              <TabsContent value="history" className="space-y-4 outline-none mt-0">
                <div className="border rounded-md bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Fecha</TableHead>
                        <TableHead className="w-[100px]">Tipo</TableHead>
                        <TableHead className="w-[150px]">Autor</TableHead>
                        <TableHead>Detalle de Cambios</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changelog.length > 0 ? (
                        changelog.slice().reverse().map((log: any, index: number) => (
                          <TableRow key={index}>
                            <TableCell className="text-xs font-medium">{new Date(log.timestamp).toLocaleString("es-MX")}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={log.changeType === "Creación" ? "default" : "secondary"}>
                                {log.changeType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.userName}</TableCell>
                            <TableCell className="text-xs font-medium text-slate-800">{log.details}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">
                            No hay registros históricos aún en esta cuenta.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

            </div>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4 flex gap-2">
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          <Button onClick={() => onEdit(client)} className="bg-primary hover:bg-primary/95 text-white">
            <Edit className="mr-2 h-4 w-4" /> Editar Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
