
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
import { SupplierManager } from "@/components/admin/supplier-manager";

export default function SuppliersPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Truck className="w-6 h-6" />
                    <CardTitle>Proveedores</CardTitle>
                </div>
                <CardDescription>Añadir, ver y gestionar la información de tus proveedores.</CardDescription>
            </CardHeader>
            <CardContent>
                <SupplierManager />
            </CardContent>
        </Card>
    )
}
