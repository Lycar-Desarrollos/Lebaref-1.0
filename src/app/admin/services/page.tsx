
import { ServiceManager } from "@/components/admin/service-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export default function ServicesPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Wrench className="w-6 h-6" />
                    <CardTitle>Gestión de Servicios</CardTitle>
                </div>
                <CardDescription>Añadir, editar y eliminar servicios de mantenimiento preventivo y correctivo.</CardDescription>
            </CardHeader>
            <CardContent>
                <ServiceManager />
            </CardContent>
        </Card>
    )
}
