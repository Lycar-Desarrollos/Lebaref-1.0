

import { PurchaseOrderManager } from "@/components/admin/purchase-order-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function PurchaseOrdersPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <ShoppingCart className="w-6 h-6" />
                    <CardTitle>Órdenes de Compra</CardTitle>
                </div>
                <CardDescription>Crear, ver, editar y eliminar órdenes de compra a proveedores.</CardDescription>
            </CardHeader>
            <CardContent>
                <PurchaseOrderManager />
            </CardContent>
        </Card>
    )
}
