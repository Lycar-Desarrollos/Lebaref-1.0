"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Inicio de sesión exitoso",
        description: "Has sido redirigido a tu panel.",
      });
      router.push("/admin");
    } catch (error: any) {
      console.error("Error signing in: ", error);
      let description = "Ocurrió un error inesperado.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        description = "Credenciales inválidas. Por favor, verifique su correo y contraseña.";
      } else if (error.code === 'auth/invalid-email') {
        description = "El correo electrónico no es válido o está vacío.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        title: "Fallo en el inicio de sesión",
        description: description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-7">
      <div className="relative col-span-3 hidden flex-col items-center justify-center p-8 text-white md:flex">
        <Image
          src="https://res.cloudinary.com/mundodepixeles/image/upload/v1768286128/photo-1541888946425-d81bb19240f5_enhjmo.avif"
          alt="Taller de mantenimiento"
          fill
          className="object-cover"
          data-ai-hint="workshop tools"
        />
        <div className="absolute inset-0 bg-white/75" />
        <div className="relative z-10 mt-8 text-center">
          <Logo className="justify-center" width={150} height={38} />
        </div>
      </div>
      <div className="col-span-4 flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-sm">
            <div className="text-center mb-8">
                <div className="mx-auto bg-primary/10 text-primary w-fit p-3 rounded-full mb-4">
                    <LogIn className="w-8 h-8"/>
                </div>
                <h1 className="text-2xl font-bold font-headline">Inicio de Sesión</h1>
                <p className="text-muted-foreground">Ingresa tus credenciales para acceder.</p>
            </div>
          <form onSubmit={handleSignIn} className="space-y-6">
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
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Input 
                  id="password" 
                  type={showPassword ? "text" : "password"}
                  placeholder="********"
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
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
            {/* <p className="text-sm text-muted-foreground text-center">
               ¿No tienes cuenta? <Link href="/signup" className="font-semibold text-primary hover:underline">Regístrate</Link>
            </p> */}
          </form>
        </div>
      </div>
    </div>
  );
}
