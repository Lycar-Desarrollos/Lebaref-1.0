

import { Suspense } from "react";
import { QuoteManager } from "@/components/admin/quote-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

export default function QuotesPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <FileText className="w-6 h-6" />
                    <CardTitle>Gestión de Cotizaciones</CardTitle>
                </div>
                <CardDescription>Crear, ver, editar y eliminar cotizaciones para los clientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <Suspense fallback={
                    <div className="flex justify-center p-8">
                        <FileText className="h-8 w-8 animate-pulse text-muted-foreground" />
                    </div>
                }>
                    <QuoteManager />
                </Suspense>
            </CardContent>
        </Card>
    )
}
