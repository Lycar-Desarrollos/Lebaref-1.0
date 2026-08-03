# Lebaref - STICS Support Hub
# Resumen Ejecutivo del Proyecto

---

## Estado General de la Plataforma

```mermaid 
graph TD
    PLAT["LEBAREF - STICS Support Hub\nPlataforma de Gestion Empresarial"] --> PUB
    PLAT --> ADMIN
    PLAT --> SEG

    subgraph PUB ["SITIO WEB PUBLICO - COMPLETO"]
        P1["Pagina Principal"]
        P2["Catalogo de Servicios"]
        P3["Solicitud de Cotizacion"]
        P4["Preguntas Frecuentes"]
        P5["Contacto"]
        P6["Blog"]
        P7["Nosotros"]
        P8["Registro de Usuarios"]
        P9["Inicio de Sesion"]
        P10["Sistema de Tickets\npara clientes"]
    end

    subgraph ADMIN ["PANEL DE ADMINISTRACION"]
        direction TB
        A1["Dashboard\nPantalla Principal"]
        
        subgraph VENTAS ["MODULO VENTAS"]
            V1["Clientes\nCRUD Completo + Sucursales\n+ Facturacion + Contactos"]
            V2["Cotizaciones\nCrear, Editar, Eliminar"]
            V3["Cuentas por Cobrar\nSaldos y Créditos"]
        end

        subgraph COMPRAS ["MODULO COMPRAS"]
            C1["Ordenes de Compra\nCrear, Editar, Eliminar"]
            C2["Proveedores\nCRUD Completo + Credito"]
        end

        subgraph ALMACEN ["MODULO ALMACENES"]
            AL1["Servicios\nCatalogo Editable"]
            AL2["Refacciones\nInventario"]
        end

        subgraph HERRAM ["HERRAMIENTAS"]
            H1["Calendario"]
            H2["Reportes"]
        end

        subgraph ADMIN_CTRL ["CONTROL ADMINISTRATIVO"]
            U1["Gestion de Usuarios\nCrear empleados con\npermisos por modulo"]
        end

        subgraph SOPORTE ["SOPORTE"]
            S1["Tickets de Soporte\nVer, Gestionar, Resolver"]
            S2["Proyectos\nCrear y Dar Seguimiento"]
        end
    end

    subgraph SEG ["SEGURIDAD Y PERMISOS"]
        R1["Autenticacion Firebase\nLogin seguro con correo"]
        R2["Rol Admin\nAcceso total a todo"]
        R3["Rol Empleado\nAcceso solo a modulos\nautorizados"]
        R4["Reglas Firestore\nProteccion a nivel\nde base de datos"]
    end

    style PLAT fill:#1e293b,stroke:#3b82f6,color:#fff
    style PUB fill:#0f2a1e,stroke:#22c55e,color:#fff
    style VENTAS fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style COMPRAS fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style ALMACEN fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style HERRAM fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style ADMIN_CTRL fill:#1a1a2e,stroke:#3b82f6,color:#fff
    style SOPORTE fill:#1a1a2e,stroke:#3b82f6,color:#fff 
    style SEG fill:#2a1a0f,stroke:#f97316,color:#fff
```

---

## Estado de Avance por Modulo

```mermaid
graph LR
    subgraph LISTO ["TERMINADO Y FUNCIONAL"]
        direction TB
        OK1["Sitio Web Publico\nTodas las paginas"]
        OK2["Login y Registro\nAutenticacion"]
        OK3["Dashboard Admin\nPantalla principal"]
        OK4["Clientes\nFormulario completo con\n4 secciones y sucursales"]
        OK5["Proveedores\nCRUD con credito"]
        OK6["Cotizaciones\nCRUD con partidas"]
        OK7["Ordenes de Compra\nCRUD con partidas"]
        OK8["Servicios\nCatalogo editable"]
        OK9["Refacciones\nInventario"]
        OK10["Tickets de Soporte\nCrear y gestionar"]
        OK11["Proyectos\nCrear y dar seguimiento"]
        OK12["Control de Usuarios\nCrear con permisos"]
        OK13["Permisos por Modulo\nAdmin vs Empleado"]
        OK14["Reglas de Seguridad\nFirestore Rules"]
        OK15["Cuentas por Cobrar\nSaldos y Abonos"]
    end

    subgraph PENDIENTE ["PENDIENTE DE VALIDAR"]
        direction TB
        P1["Calendario\nInterfaz existe,\nfalta conectar datos"]
        P2["Reportes\nInterfaz existe,\nfalta conectar datos"]
        P3["Notificaciones por correo\nAlertas de clientes\ninactivos al vendedor"]
        P4["Documentos fiscales\nadjuntos en Clientes\nRequiere Firebase Storage"]
        P5["IA - Priorizacion\nde Tickets automatica\nRequiere API Key de Gemini"]
    end

    style LISTO fill:#052e16,stroke:#22c55e,color:#fff
    style PENDIENTE fill:#451a03,stroke:#f59e0b,color:#fff
```

---

## Como Funciona el Sistema de Permisos

```mermaid
graph TD
    JEFE["El Administrador\ncrea un empleado"] --> ASIGNA["Le asigna permisos\npor modulo"]
    
    ASIGNA --> PERM1["Clientes = SI"]
    ASIGNA --> PERM2["Cotizaciones = SI"]
    ASIGNA --> PERM3["Proyectos = NO"]
    ASIGNA --> PERM4["Proveedores = NO"]
    
    PERM1 --> VE1["El empleado VE y CREA\nclientes"]
    PERM2 --> VE2["El empleado VE y CREA\ncotizaciones"]
    PERM3 --> NOVE3["El empleado NO VE\nproyectos en su menu"]
    PERM4 --> NOVE4["El empleado NO VE\nproveedores en su menu"]

    ADMIN["El Admin siempre\nve TODO y puede\nhacer TODO"]

    style JEFE fill:#1e293b,stroke:#3b82f6,color:#fff
    style ADMIN fill:#064e3b,stroke:#10b981,color:#fff
    style NOVE3 fill:#7f1d1d,stroke:#ef4444,color:#fff
    style NOVE4 fill:#7f1d1d,stroke:#ef4444,color:#fff
    style VE1 fill:#052e16,stroke:#22c55e,color:#fff
    style VE2 fill:#052e16,stroke:#22c55e,color:#fff
```

---

## Flujo de Trabajo Tipico

```mermaid
graph LR
    A["Vendedor registra\nun CLIENTE nuevo"] --> B["Crea una\nCOTIZACION\npara ese cliente"]
    B --> C["El cliente\nAPRUEBA"]
    C --> D["Se crea un\nPROYECTO"]
    C --> CXC["Se genera saldo en\nCUENTAS POR COBRAR"]
    D --> E["Se generan\nORDENES DE COMPRA\na proveedores"]
    E --> F["Se asignan\nSERVICIOS y\nREFACCIONES"]
    F --> G["Se da seguimiento\nen el CALENDARIO"]
    G --> H["Se generan\nREPORTES"]

    style A fill:#1e293b,stroke:#3b82f6,color:#fff
    style B fill:#1e293b,stroke:#3b82f6,color:#fff
    style C fill:#064e3b,stroke:#10b981,color:#fff
    style CXC fill:#1e293b,stroke:#3b82f6,color:#fff
    style D fill:#1e293b,stroke:#3b82f6,color:#fff
    style E fill:#1e293b,stroke:#3b82f6,color:#fff
    style F fill:#1e293b,stroke:#3b82f6,color:#fff
    style G fill:#1e293b,stroke:#3b82f6,color:#fff
    style H fill:#1e293b,stroke:#3b82f6,color:#fff
```

---

## Tecnologia Utilizada (Resumen No Tecnico)

```mermaid
graph TD
    subgraph "Lo que ve el usuario"
        FE["Aplicacion Web\nFunciona en cualquier\nnavegador y celular"]
    end

    subgraph "Lo que protege los datos"
        AUTH["Sistema de Login\nCorreo y contrasena\nsegura"]
        RULES["Reglas de Acceso\nCada usuario solo ve\nlo que le corresponde"]
    end

    subgraph "Donde se guardan los datos"
        DB["Base de Datos en la Nube\nGoogle Firebase\nDisponible 24/7"]
    end

    subgraph "Extras"
        AI["Inteligencia Artificial\nClasifica tickets\nautomaticamente"]
        ANALYTICS["Metricas de Uso\nSaber cuantos usuarios\nusan la plataforma"]
    end

    FE --> AUTH
    AUTH --> RULES
    RULES --> DB
    FE --> AI
    FE --> ANALYTICS

    style FE fill:#1e293b,stroke:#3b82f6,color:#fff
    style DB fill:#0f172a,stroke:#f97316,color:#fff
    style AUTH fill:#2a1a0f,stroke:#f97316,color:#fff
    style RULES fill:#2a1a0f,stroke:#f97316,color:#fff
```
