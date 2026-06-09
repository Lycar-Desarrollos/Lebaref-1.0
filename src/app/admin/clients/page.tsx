import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { ClientManager } from "@/components/admin/client-manager";

export default function ClientsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Users className="w-6 h-6" />
                    <CardTitle>Cartera de Clientes</CardTitle>
                </div>
                <CardDescription>Añadir, ver y gestionar la información de todos tus clientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <ClientManager />
            </CardContent>
        </Card>
    )
}
