# Flujo de Trabajo - Módulo de Cuentas por Cobrar

Este módulo permite a los administradores y usuarios autorizados dar seguimiento a las cotizaciones pendientes de pago, filtrar por cliente y rango de fecha, registrar abonos/pagos y exportar reportes ejecutivos.

## Diagrama de Secuencia - Consulta y Pago

```mermaid
sequenceDiagram
    participant U as Usuario / Administrador
    participant P as CuentasPorCobrarPage
    participant FS as Cloud Firestore
    participant JS as jsPDF / XLSX (Librerías)

    U->>P: Accede a /admin/cuentas-por-cobrar
    P->>FS: Verifica permisos del usuario
    alt Tiene Permiso (admin o accounts_receivable/reports/quotes)
        P->>FS: onSnapshot("quotes") (tiempo real)
        P->>FS: onSnapshot("clients") (tiempo real)
        FS-->>P: Retorna cotizaciones y clientes
        P-->>U: Muestra panel con KPIs y tabla de saldos
    else No Tiene Permiso
        P-->>U: Redirige a /admin con alerta de error
    end

    opt Filtrado de Datos
        U->>P: Selecciona Cliente, Estado (Pendiente/Pagada) o Rango de Fechas
        P->>P: Filtra cotizaciones en memoria
        P-->>U: Actualiza lista y totales acumulados
    end

    opt Registrar Pago
        U->>P: Clic en "Registrar Pago" en una cotización
        P->>U: Solicita confirmación de liquidación
        U->>P: Confirma pago
        P->>FS: updateDoc("quotes/{id}", { status: "Pagada" })
        FS-->>P: Confirmación de actualización
        P-->>U: Muestra Toast de éxito y actualiza tabla en tiempo real
    end

    opt Exportar Reporte
        U->>P: Clic en "Exportar PDF" o "Exportar Excel"
        P->>JS: Procesa datos filtrados en memoria
        JS-->>U: Descarga de archivo reporte_cxc.pdf o cxc.xlsx
    end
```
