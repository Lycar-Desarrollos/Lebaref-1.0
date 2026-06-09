
"use client";

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Loader2, Briefcase, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { es } from 'date-fns/locale';

type Project = {
    id: string;
    client: string;
    description: string;
    responsible: string;
    status: "Nuevo" | "En Progreso" | "En Pausa" | "Completado";
    programmedDate: string; // YYYY-MM-DD
    priority: "Baja" | "Media" | "Alta";
    userId: string;
};

type UserProfile = {
    role: 'admin' | 'employee';
};

export default function CalendarPage() {
    const { user, isLoading: authIsLoading } = useAuth();
    const router = useRouter();
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [projects, setProjects] = useState<Project[]>([]);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const PROJECTS_PER_PAGE = 3;

    useEffect(() => {
        if (authIsLoading) return;
        if (!user) {
            router.push('/');
            return;
        }

        const unsubProfile = onSnapshot(doc(db, "users", user.uid), (doc) => {
            if(doc.exists()) {
              setUserProfile(doc.data() as UserProfile);
            }
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `users/${user.uid}`,
                operation: 'get',
            }));
        });
        
        return () => unsubProfile();

    }, [user, authIsLoading, router]);

    useEffect(() => {
        if (!user || !userProfile) {
            if(!authIsLoading) setIsLoading(false);
            return;
        };
        
        setIsLoading(true);
        const is_admin = userProfile.role === 'admin';
        const projectsQuery = is_admin 
            ? query(collection(db, "projects"))
            : query(collection(db, "projects"), where("userId", "==", user.uid));
        
        const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
            const projectsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Project));
            setProjects(projectsData);
            setIsLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'projects',
                operation: 'list',
            }));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [user, userProfile, authIsLoading]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [date]);

    const { selectedDayProjects, projectModifiers } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const selectedDateStr = date?.toISOString().split('T')[0];
        const allSelectedDayProjects = projects.filter(p => p.programmedDate === selectedDateStr);

        // Logic for calendar dots
        const dateGroups: Record<string, Set<Project['status']>> = {};
        projects.forEach(p => {
            if (!p.programmedDate) return;
            const dateStr = p.programmedDate;
            if (!dateGroups[dateStr]) {
                dateGroups[dateStr] = new Set();
            }
            dateGroups[dateStr].add(p.status);
        });

        const finalModifiers: Record<string, Date[]> = {
            vencido: [],
            completado: [],
            enProgreso: [],
            enPausa: [],
            nuevo: [],
        };
        
        const statusPriority: Project['status'][] = ["En Progreso", "En Pausa", "Nuevo", "Completado"];
        
        for (const dateStr in dateGroups) {
            const statuses = dateGroups[dateStr];
            const projectDate = new Date(dateStr.replace(/-/g, '\/'));
            
            const isOverdue = projectDate < today && (statuses.has("Nuevo") || statuses.has("En Progreso") || statuses.has("En Pausa"));
            
            if (isOverdue) {
                finalModifiers.vencido.push(projectDate);
            } else {
                let assigned = false;
                for (const status of statusPriority) {
                    if (statuses.has(status)) {
                        if (status === "En Progreso") finalModifiers.enProgreso.push(projectDate);
                        else if (status === "En Pausa") finalModifiers.enPausa.push(projectDate);
                        else if (status === "Nuevo") finalModifiers.nuevo.push(projectDate);
                        else if (status === "Completado") finalModifiers.completado.push(projectDate);
                        assigned = true;
                        break; 
                    }
                }
            }
        }

        return { 
            selectedDayProjects: allSelectedDayProjects,
            projectModifiers: finalModifiers, 
        };
    }, [date, projects]);

    const totalPages = Math.ceil(selectedDayProjects.length / PROJECTS_PER_PAGE);
    const paginatedProjects = selectedDayProjects.slice(
        (currentPage - 1) * PROJECTS_PER_PAGE,
        currentPage * PROJECTS_PER_PAGE
    );
    
    const projectModifiersClassNames = {
        vencido: 'project-vencido',
        completado: 'project-completado',
        enProgreso: 'project-en-progreso',
        enPausa: 'project-en-pausa',
        nuevo: 'project-nuevo',
    };

    if (isLoading || authIsLoading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-1">
                 <CardHeader>
                    <CardTitle>Calendario de Proyectos</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                     <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="p-0"
                        modifiers={projectModifiers}
                        modifiersClassNames={projectModifiersClassNames}
                        locale={es}
                    />
                </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Proyectos para el {date ? date.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '...'}
                        </CardTitle>
                         <CardDescription>Proyectos programados para la fecha seleccionada.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       {selectedDayProjects.length > 0 ? (
                           <>
                            <ProjectList projects={paginatedProjects} />
                            {totalPages > 1 && (
                                <div className="flex items-center justify-end space-x-2 pt-4">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Anterior
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Siguiente
                                    </Button>
                                </div>
                            )}
                           </>
                       ) : (
                           <div className="text-center text-muted-foreground py-10">
                                <Briefcase className="mx-auto h-12 w-12" />
                                <p className="mt-4">No hay proyectos para esta fecha.</p>
                           </div>
                       )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


function ProjectList({ projects }: { projects: Project[] }) {
    const router = useRouter();
    return (
        <div className="space-y-4">
            {projects.map(project => (
                <div key={project.id} className="p-4 rounded-lg border bg-card flex justify-between items-center gap-4">
                    <div className="flex-grow">
                        <p className="font-semibold">{project.client}</p>
                        <p className="text-sm text-muted-foreground truncate max-w-md">{project.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">Responsable: {project.responsible}</p>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2 shrink-0">
                         <div className="flex gap-2">
                            <Badge variant="outline" className={cn('capitalize', {
                                'text-red-600 border-red-600': project.priority === 'Alta',
                                'text-yellow-600 border-yellow-600': project.priority === 'Media',
                                'text-green-600 border-green-600': project.priority === 'Baja',
                            })}>{project.priority}</Badge>
                             <Badge variant="outline" className={cn('capitalize', {
                               'text-blue-600 border-blue-600': project.status === 'Nuevo',
                               'text-yellow-600 border-yellow-600': project.status === 'En Progreso',
                               'text-red-600 border-red-600': project.status === 'En Pausa',
                               'text-green-600 border-green-600': project.status === 'Completado',
                            })}>{project.status}</Badge>
                         </div>
                         <Button variant="secondary" size="sm" className="mt-1 h-8" onClick={() => router.push(`/admin/projects?highlight=${project.id}`)}>
                            Ir a Proyecto
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}
