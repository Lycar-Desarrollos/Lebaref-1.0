"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Logo } from "@/components/logo";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) {
      toast({
        title: "Fallo en el Registro",
        description: "El número telefónico debe tener al menos 10 dígitos.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userCounterRef = doc(db, "counters", "users");
      const userDocRef = doc(db, "users", user.uid);

      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(userCounterRef);
        let newUserCodeNumber = 1;
        if (counterDoc.exists() && counterDoc.data().lastNumber) {
          newUserCodeNumber = counterDoc.data().lastNumber + 1;
        }
        
        transaction.set(userCounterRef, { lastNumber: newUserCodeNumber }, { merge: true });

        const userCode = String(newUserCodeNumber).padStart(2, '0');

        transaction.set(userDocRef, {
          uid: user.uid,
          email: user.email,
          phone: phone,
          role: "user",
          createdAt: serverTimestamp(),
          userCode: userCode,
          quoteCounter: 0,
          purchaseOrderCounter: 0
        });
      });
      
      router.push("/profile");
      
      toast({
        title: "Cuenta Creada",
        description: "Tu cuenta ha sido creada exitosamente. Redirigiendo a tu panel...",
      });

    } catch (error: any) {
      console.error("Error signing up: ", error);
      let description = "Ocurrió un error inesperado. Por favor, intente de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este correo ya está registrado. Por favor, intenta iniciar sesión.";
      } else if (error.code === 'auth/weak-password') {
        description = "La contraseña es muy débil. Por favor, elige una más segura.";
      } else if (error.message) {
        description = error.message;
      }
      
      toast({
        title: "Fallo en el Registro",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
     <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-7">
       <div className="col-span-4 flex items-center justify-center bg-background p-8 order-2 md:order-1">
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <div className="mx-auto bg-primary/10 text-primary w-fit p-3 rounded-full mb-4">
                    <UserPlus className="w-8 h-8"/>
                </div>
                <h1 className="text-2xl font-bold font-headline">Crear una Cuenta</h1>
                <p className="text-muted-foreground">Ingresa tus datos para registrarte.</p>
            </div>
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="correo@ejemplo.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Número Telefónico *</Label>
              <Input 
                id="phone" 
                type="tel" 
                placeholder="Teléfono de 10 dígitos" 
                required 
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
               <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  required 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                 <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7 text-muted-foreground"
                    onClick={() => setShowPassword(prev => !prev)}
                >
                    {showPassword ? <EyeOff /> : <Eye />}
                    <span className="sr-only">{showPassword ? 'Ocultar' : 'Mostrar'} contraseña</span>
                </Button>
              </div>
            </div>
            <Button className="w-full" type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting ? "Creando cuenta..." : "Registrarse"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
               ¿Ya tienes una cuenta? <Link href="/" className="font-semibold text-primary hover:underline">Inicia Sesión</Link>
            </p>
          </form>
        </div>
      </div>
       <div className="relative col-span-3 hidden flex-col items-center justify-center p-8 text-white md:flex order-1 md:order-2">
        <Image
          src="https://ucarecdn.com/2e73c219-cd6c-4d47-abfd-e4b2a36f286b/normal_65b16ffde4984.webp"
          alt="Mantenimiento de equipo de cocina"
          fill
          className="object-cover"
          data-ai-hint="kitchen maintenance"
        />
        <div className="absolute inset-0 bg-white/75" />
        <div className="relative z-10 mt-8 text-center">
          <Logo className="justify-center" width={320} height={180} />
        </div>
      </div>
    </div>
  );
}
