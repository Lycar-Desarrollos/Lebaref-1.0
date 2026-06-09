
import { SparePartsManager } from "@/components/admin/spare-parts-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function SparePartsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Package className="w-6 h-6" />
                    <CardTitle>Gestión de Refacciones</CardTitle>
                </div>
                <CardDescription>Añadir, editar y eliminar refacciones del inventario.</CardDescription>
            </CardHeader>
            <CardContent>
                <SparePartsManager />
            </CardContent>
        </Card>
    )
}
