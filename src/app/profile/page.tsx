
"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User, LogOut, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorEmitter } from "@/lib/error-emitter";
import { FirestorePermissionError } from "@/lib/errors";

type UserProfile = {
  email: string;
  role: 'user' | 'admin';
  displayName?: string;
  photoURL?: string;
  phone?: string;
};

export default function ProfilePage() {
  const { user, isLoading: authIsLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSyncing, setIsSyncing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (authIsLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchUserProfile = async () => {
      setIsSyncing(true);
      const userDocRef = doc(db, "users", user.uid);
      try {
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data() as UserProfile;
          setProfile(userData);
          setDisplayName(user.displayName || userData.displayName || '');
          setPhone(userData.phone || '');
        } else {
          // If doc doesn't exist, create it.
          const newUserProfile: UserProfile = {
            email: user.email || '',
            role: "user", // Default role
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            phone: '',
          };
          setDoc(userDocRef, newUserProfile).catch(serverError => {
              errorEmitter.emit('permission-error', new FirestorePermissionError({
                  path: userDocRef.path,
                  operation: 'create',
                  requestResourceData: newUserProfile
              }));
          });
          setProfile(newUserProfile);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar tu perfil.",
          variant: "destructive"
        });
      } finally {
        setIsSyncing(false);
      }
    };

    fetchUserProfile();
  }, [user, authIsLoading, router, toast]);

  const handleSaveChanges = async () => {
    if (!user) return;
    if (phone.length < 10) {
      toast({
        title: "Error al Guardar",
        description: "El número telefónico debe tener al menos 10 dígitos.",
        variant: "destructive"
      });
      return;
    }
    setIsSaving(true);
    const userDocRef = doc(db, "users", user.uid);
    const payload = { displayName, phone };
    try {
        // Update Firebase Auth profile
        await updateProfile(user, { displayName });
        
        // Update Firestore document
        await updateDoc(userDocRef, payload);

        setProfile(prev => prev ? { ...prev, displayName, phone } : null);

        toast({
            title: "Perfil Actualizado",
            description: "Tus cambios han sido guardados exitosamente.",
        });
    } catch (error: any) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: payload
        }));
    } finally {
        setIsSaving(false);
    }
  };


  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast({
        title: "Sesión Cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
      router.push("/");
    } catch (error: any) {
      toast({
        title: "Fallo al Cerrar Sesión",
        description: error.message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    }
  };

  if (authIsLoading || isSyncing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) {
    return null; // Redirecting is handled in useEffect
  }
  
  const isAdmin = profile.role === 'admin';

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-2xl mx-auto">
        <Button variant="outline" onClick={() => router.back()} className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
        </Button>
        <Card>
          <CardHeader className="text-center">
            <Avatar className="mx-auto h-24 w-24 mb-4 border-2 border-primary/20">
              <AvatarImage src={profile.photoURL} alt={displayName} />
              <AvatarFallback>
                <User className="h-12 w-12" />
              </AvatarFallback>
            </Avatar>
            <CardTitle className="text-2xl font-headline">
              {isAdmin ? 'Panel de Administrador' : 'Panel de Cliente'}
            </CardTitle>
            <CardDescription>Gestiona tu información y preferencias de la cuenta.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre a Mostrar</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Tu nombre"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Número Telefónico</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Tu teléfono de 10 dígitos"
              />
            </div>
             <div className="border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">Correo Electrónico</p>
              <p className="text-lg font-semibold">{user.email}</p>
            </div>
             {isAdmin && (
                <Button asChild className="w-full bg-accent hover:bg-accent/90">
                    <Link href="/admin">
                        <ShieldCheck className="mr-2 h-4 w-4"/>
                        Ir al Panel de Administración
                    </Link>
                </Button>
            )}
            <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar Cambios"}
            </Button>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
