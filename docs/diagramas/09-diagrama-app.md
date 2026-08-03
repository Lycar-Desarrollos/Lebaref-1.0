# Diagrama General de la Aplicación (Lebaref - STICS Hub)

Este diagrama describe de manera integral la estructura de navegación, los módulos funcionales y las relaciones de datos de la plataforma.

## Mapa de Componentes y Flujos de la App

```mermaid
flowchart TB
    %% Nodes
    subgraph Public ["Sitio Público (Sin login)"]
        Landing["Landing Page (/)"]
        Auth["Registro / Iniciar Sesión (/login, /signup)"]
    end

    subgraph AuthArea ["Área de Cliente Autenticado"]
        Profile["Mi Perfil (/profile)"]
        MyTickets["Mis Tickets (/profile/my-tickets)"]
        NewTicket["Nuevo Ticket (/tickets/new)"]
    end

    subgraph AdminDashboard ["Panel Admin (/admin) - Control de Módulos"]
        DashMain["Admin Home / KPI Summary"]
        
        subgraph ModulosVentas ["Módulo de Ventas & Clientes"]
            Clients["Clientes (/admin/clients)"]
            Quotes["Cotizaciones (/admin/quotes)"]
            CxC["Cuentas por Cobrar (/admin/cuentas-por-cobrar)"]
        end

        subgraph ModulosSoporte ["Módulo de Soporte & Operaciones"]
            Tickets["Tickets de Soporte (/admin/tickets)"]
            Projects["Proyectos (/admin/projects)"]
            Calendar["Calendario (/admin/calendar)"]
        end

        subgraph ModulosCompras ["Módulo de Compras & Almacén"]
            Suppliers["Proveedores (/admin/suppliers)"]
            PO["Órdenes de Compra (/admin/purchase-orders)"]
            Services["Catálogo de Servicios (/admin/services)"]
            Parts["Inventario de Refacciones (/admin/spare-parts)"]
        end

        subgraph ControlAdmin ["Control y Reportes"]
            Users["Gestión de Usuarios (/admin/users)"]
            Reports["Reportes (/admin/reports)"]
        end
    end

    subgraph Firebase ["Backend & Storage"]
        FireAuth["Firebase Auth"]
        Firestore["Cloud Firestore"]
    end

    %% Relations
    Landing --> Auth
    Auth -->|Redirección según Rol| Profile
    Auth -->|Redirección según Rol| DashMain

    %% Admin Sub-navigation
    DashMain --> Clients
    DashMain --> Quotes
    DashMain --> CxC
    DashMain --> Tickets
    DashMain --> Projects
    DashMain --> Calendar
    DashMain --> Suppliers
    DashMain --> PO
    DashMain --> Services
    DashMain --> Parts
    DashMain --> Users
    DashMain --> Reports

    %% Inter-module relation examples
    Clients -->|Genera| Quotes
    Quotes -->|Si es aprobada -> Proyecto| Projects
    Quotes -->|Si es cobrada/crédito| CxC
    Projects -->|Requiere refacciones/compras| PO
    PO -->|Asociado a| Suppliers
    Tickets -->|Se asocia a| Clients

    %% Authentication & Database Access
    AuthArea -.->|Requiere Auth| FireAuth
    AdminDashboard -.->|Requiere Auth + Rol Admin/Empleado| FireAuth
    AdminDashboard -.->|Lectura / Escritura en tiempo real| Firestore

    %% Styles
    classDef public fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff;
    classDef client fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#fff;
    classDef admin fill:#451a03,stroke:#f97316,stroke-width:2px,color:#fff;
    classDef sales fill:#0f2d3a,stroke:#0ea5e9,stroke-width:2px,color:#fff;
    classDef ops fill:#14532d,stroke:#22c55e,stroke-width:2px,color:#fff;
    classDef purchases fill:#3b0764,stroke:#a855f7,stroke-width:2px,color:#fff;
    classDef backend fill:#052e16,stroke:#10b981,stroke-dasharray: 5 5,color:#fff;

    class Landing,Auth public;
    class Profile,MyTickets,NewTicket client;
    class DashMain,Users,Reports admin;
    class Clients,Quotes,CxC sales;
    class Tickets,Projects,Calendar ops;
    class Suppliers,PO,Services,Parts purchases;
    class FireAuth,Firestore,Firebase backend;
```

## Resumen de Estructura e Interacciones

1. **Rutas Públicas**:
   - Todo visitante inicia en el sitio web corporativo o accede directamente a `/login` / `/signup`.

2. **Flujo de Clientes**:
   - Al iniciar sesión, los clientes regulares son redirigidos a su perfil y área de tickets, desde donde pueden abrir nuevos requerimientos de soporte.

3. **Panel Administrativo (Admin & Empleados)**:
   - Dividido en 4 áreas fundamentales:
     - **Ventas & Clientes**: Control de datos de clientes, cotizaciones y la gestión de saldos/créditos mediante **Cuentas por Cobrar**.
     - **Soporte & Operaciones**: Seguimiento de incidencias de clientes (Tickets), planeación de trabajos a largo plazo (Proyectos) y visualización de agenda (Calendario).
     - **Compras & Almacén**: Control de insumos/refacciones en stock, definición de servicios base y gestión de compras a proveedores.
     - **Control y Reportes**: Auditoría de personal (Permisos por módulo) y analíticas de ventas y rendimiento global.
