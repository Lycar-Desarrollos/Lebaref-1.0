
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
import { Loader2, PlusCircle, MoreHorizontal, Edit, Trash2, Eye, EyeOff, User, UserPlus, Key } from "lucide-react";
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
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, runTransaction } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/hooks/use-auth";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, type User as FirebaseUser } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";

// IMPORTANT: We need a secondary Firebase app instance to create users
// because the primary `auth` instance might be signed in as the admin,
// and you can't create a new user while another is logged in on the same auth instance.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const apps = getApps();
const userCreationApp = apps.find(app => app.name === 'userCreation') || initializeApp(firebaseConfig, 'userCreation');
const userCreationAuth = getAuth(userCreationApp);

const modules = [
    { id: 'projects', label: 'Proyectos' },
    { id: 'quotes', label: 'Cotizaciones' },
    { id: 'clients', label: 'Clientes' },
    { id: 'purchase_orders', label: 'Órdenes de Compra' },
    { id: 'suppliers', label: 'Proveedores' },
    { id: 'services', label: 'Servicios' },
    { id: 'spare_parts', label: 'Refacciones' },
    { id: 'calendar', label: 'Calendario' },
    { id: 'reports', label: 'Reportes' },
] as const;

const userSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().min(2, "El nombre es requerido."),
  email: z.string().email("Correo electrónico inválido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres.").optional().or(z.literal('')),
  role: z.enum(["admin", "employee"], { required_error: "Debe seleccionar un rol." }),
  permissions: z.array(z.string()).optional(),
}).refine((data) => {
    if (!data.id && (!data.password || data.password.length < 6)) {
        return false;
    }
    return true;
}, {
    message: "La contraseña es requerida y debe tener al menos 6 caracteres.",
    path: ["password"],
});


type UserProfile = {
    uid: string;
    displayName: string;
    email: string;
    role: "admin" | "employee";
    permissions: { [key: string]: boolean };
    createdAt: any;
    userCode: string;
    quoteCounter: number;
    purchaseOrderCounter: number;
};

export default function UsersPage() {
    const { user: adminUser, isLoading: authIsLoading } = useAuth();
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!adminUser) return;
        setIsLoading(true);
        const usersQuery = collection(db, "users");
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
            setUsers(data);
            setIsLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'users', operation: 'list' }));
            toast({ title: "Error de Permisos", description: "No tienes permiso para ver los usuarios.", variant: "destructive" });
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [adminUser, toast]);

    const handlePasswordReset = useCallback(async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            toast({
                title: "Correo de Reinicio Enviado",
                description: `Se ha enviado un enlace para reiniciar la contraseña a ${email}.`,
            });
        } catch (error: any) {
            console.error("Error sending password reset email:", error);
            toast({
                title: "Error al enviar correo",
                description: "No se pudo enviar el correo de reinicio de contraseña.",
                variant: "destructive",
            });
        }
    }, [toast]);

    const handleSaveUser = useCallback(async (data: z.infer<typeof userSchema>) => {
        if (data.id) { // UPDATE
            const userDocRef = doc(db, "users", data.id);
            const { password, id, ...updateData } = data;
            
            const finalPermissions = data.role === 'admin' ? {} : (data.permissions || []).reduce((acc, p) => ({ ...acc, [p]: true }), {});
    
            const payload = { ...updateData, permissions: finalPermissions };
    
            try {
                await updateDoc(userDocRef, payload);
                toast({ title: "Usuario Actualizado", description: `El perfil de ${data.displayName} ha sido actualizado.` });
                setIsFormOpen(false);
                setSelectedUser(null);
            } catch (serverError) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'update',
                    requestResourceData: payload,
                }));
            }
        } else { // CREATE
            if (!data.password) {
                toast({ title: "Error", description: "La contraseña es requerida para nuevos usuarios.", variant: "destructive" });
                return;
            }

            let userCredential;
            try {
                userCredential = await createUserWithEmailAndPassword(userCreationAuth, data.email, data.password);
            } catch (error: any) {
                console.error("Auth Error creating user:", error);
                const description = error.code === 'auth/email-already-in-use' ? 'El correo electrónico ya está en uso.' : 'No se pudo crear el usuario.';
                toast({ title: "Error de autenticación", description, variant: "destructive" });
                return; 
            }
            
            const newUser = userCredential.user;
            const finalPermissions = data.role === 'admin' ? {} : (data.permissions || []).reduce((acc, p) => ({ ...acc, [p]: true }), {});
            
            const userCounterRef = doc(db, "counters", "users");
            const userDocRef = doc(db, "users", newUser.uid);

            try {
                await runTransaction(db, async (transaction) => {
                    const counterDoc = await transaction.get(userCounterRef);
                    let newUserCodeNumber = 1;
                    if (counterDoc.exists() && counterDoc.data().lastNumber) {
                        newUserCodeNumber = counterDoc.data().lastNumber + 1;
                    }
                    
                    transaction.set(userCounterRef, { lastNumber: newUserCodeNumber }, { merge: true });
            
                    const userCode = String(newUserCodeNumber).padStart(2, '0');
                    
                    const userData = {
                        uid: newUser.uid,
                        displayName: data.displayName,
                        email: data.email,
                        role: data.role,
                        permissions: finalPermissions,
                        createdAt: serverTimestamp(),
                        userCode: userCode,
                        quoteCounter: 0,
                        purchaseOrderCounter: 0
                    };
            
                    transaction.set(userDocRef, userData);
                });

                await userCreationAuth.signOut();
                toast({ title: "Usuario Creado", description: `La cuenta para ${data.email} ha sido creada.` });
                setIsFormOpen(false);
                setSelectedUser(null);
            } catch (serverError) {
                 errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: userDocRef.path,
                    operation: 'create',
                    requestResourceData: {},
                }));
            }
        }
    }, [toast, setIsFormOpen, setSelectedUser]);
    
    const columns: ColumnDef<UserProfile>[] = useMemo(() => [
        { accessorKey: "displayName", header: "Nombre" },
        { accessorKey: "email", header: "Correo" },
        { accessorKey: "role", header: "Rol" },
        { accessorKey: "userCode", header: "Código" },
        { id: "actions",
          cell: ({ row }) => (
              <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent>
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => { setSelectedUser(row.original); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/> Editar</DropdownMenuItem>
                       <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={e => e.preventDefault()}><Key className="mr-2 h-4 w-4"/> Restablecer Contraseña</DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>¿Enviar correo de restablecimiento?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Se enviará un correo a <strong>{row.original.email}</strong> con un enlace seguro para que el usuario pueda restablecer su contraseña.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handlePasswordReset(row.original.email)}>Enviar Correo</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                  </DropdownMenuContent>
              </DropdownMenu>
          )
        }
    ], [handlePasswordReset]);
  
    const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() });
  
    if (isLoading && authIsLoading) {
      return <div className="flex justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <User className="w-6 h-6" />
                    <CardTitle>Control de Usuarios</CardTitle>
                </div>
                <CardDescription>Añadir, ver y gestionar los usuarios y sus permisos.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end mb-4">
                    <Button onClick={() => { setSelectedUser(null); setIsFormOpen(true);}}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Agregar Usuario
                    </Button>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>{table.getHeaderGroups().map(headerGroup => (<TableRow key={headerGroup.id}>{headerGroup.headers.map(header => <TableHead key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</TableHead>)}</TableRow>))}</TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map(row => (
                                    <TableRow key={row.id}>{row.getVisibleCells().map(cell => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}</TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={columns.length} className="h-24 text-center">No hay usuarios.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 <UserFormDialog
                    isOpen={isFormOpen}
                    onOpenChange={setIsFormOpen}
                    onSave={handleSaveUser}
                    user={selectedUser}
                />
            </CardContent>
        </Card>
    );
}

interface UserFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (data: z.infer<typeof userSchema>) => void;
  user: UserProfile | null;
}

function UserFormDialog({ isOpen, onOpenChange, onSave, user }: UserFormDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const form = useForm<z.infer<typeof userSchema>>({
        resolver: zodResolver(userSchema),
        defaultValues: { role: "employee", permissions: [] }
    });

    const role = form.watch("role");

    useEffect(() => {
        if (isOpen) {
          if (user) {
            const userPermissionsArray = user.permissions
              ? Object.keys(user.permissions).filter(key => user.permissions[key as keyof typeof user.permissions])
              : [];
            form.reset({
                id: user.uid,
                displayName: user.displayName,
                email: user.email,
                role: user.role,
                permissions: userPermissionsArray,
                password: '',
            });
          } else {
            form.reset({ displayName: "", email: "", password: "", role: "employee", permissions: [] });
          }
        }
      }, [user, isOpen, form]);
    
    const handleSubmit = async (data: z.infer<typeof userSchema>) => {
        setIsSubmitting(true);
        await onSave(data);
        setIsSubmitting(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{user ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
                        <FormField control={form.control} name="displayName" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Nombre Completo</FormLabel>
                                <FormControl><Input placeholder="Ej: Juan Pérez" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Correo Electrónico</FormLabel>
                                <FormControl><Input type="email" placeholder="correo@ejemplo.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        {!user && (
                            <FormField control={form.control} name="password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contraseña</FormLabel>
                                     <FormDescription>
                                        Solo para usuarios nuevos. La contraseña debe tener al menos 6 caracteres.
                                    </FormDescription>
                                    <div className="relative">
                                        <FormControl>
                                            <Input type={showPassword ? "text" : "password"} {...field} />
                                        </FormControl>
                                        <Button type="button" variant="ghost" size="icon" className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7 text-muted-foreground" onClick={() => setShowPassword(p => !p)}>
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Rol</FormLabel>
                                    <FormControl>
                                        <RadioGroup onValueChange={field.onChange} value={field.value} className="flex space-x-4">
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="employee" id="role-employee" />
                                                </FormControl>
                                                <FormLabel htmlFor="role-employee" className="font-normal">Empleado</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <RadioGroupItem value="admin" id="role-admin" />
                                                </FormControl>
                                                <FormLabel htmlFor="role-admin" className="font-normal">Administrador</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {role === 'employee' && (
                            <FormField
                                control={form.control}
                                name="permissions"
                                render={() => (
                                <FormItem>
                                    <div className="mb-4">
                                        <FormLabel className="text-base">Permisos de Módulo</FormLabel>
                                        <FormDescription>
                                            Selecciona los módulos a los que este empleado tendrá acceso.
                                        </FormDescription>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        {modules.map((item) => (
                                            <FormField
                                                key={item.id}
                                                control={form.control}
                                                name="permissions"
                                                render={({ field }) => {
                                                    return (
                                                    <FormItem
                                                        key={item.id}
                                                        className="flex flex-row items-start space-x-3 space-y-0"
                                                    >
                                                        <FormControl>
                                                        <Checkbox
                                                            checked={field.value?.includes(item.id)}
                                                            onCheckedChange={(checked) => {
                                                            return checked
                                                                ? field.onChange([...field.value || [], item.id])
                                                                : field.onChange(
                                                                    field.value?.filter(
                                                                    (value) => value !== item.id
                                                                    )
                                                                )
                                                            }}
                                                        />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                        {item.label}
                                                        </FormLabel>
                                                    </FormItem>
                                                    )
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        )}

                         <DialogFooter className="sticky bottom-0 bg-background pt-4 z-10">
                            <DialogClose asChild><Button type="button" variant="ghost">Cancelar</Button></DialogClose>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {user ? "Guardar Cambios" : "Crear Usuario"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

    

    

    