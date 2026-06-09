

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase } from "lucide-react";
import { ProjectManager } from "@/components/admin/project-manager";

export default function ProjectsPage() {
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Briefcase className="w-6 h-6" />
                    <CardTitle>Gestión de Proyectos</CardTitle>
                </div>
                <CardDescription>Crea, visualiza y gestiona todos los proyectos de tus clientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <ProjectManager />
            </CardContent>
        </Card>
    )
}
