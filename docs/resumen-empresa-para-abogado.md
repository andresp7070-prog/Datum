# Datum — resumen para contrato base de servicios

Este documento resume qué es Datum y cómo funciona comercialmente, como insumo para pasarlo a un chat legal (o directamente a un abogado) y ayudar a redactar/actualizar el contrato base de servicios entre Datum y sus clientes (pymes colombianas). Se actualiza junto con `CLAUDE.md` cada vez que cambia algo del negocio — varios puntos siguen sin decisión final, y se marcan explícitamente como pendientes.

## Qué es Datum

Datum es un servicio de **diagnóstico personalizado + plataforma de gestión** (software como servicio / SaaS) para pequeñas y medianas empresas colombianas. Reúne en un solo sistema, según qué módulos tenga contratados cada cliente: ventas, CRM (relación con clientes), inventario, estado de pérdidas y ganancias, nómina, descuentos/promociones, y un panel de control con proyecciones e insights (este último siempre incluido, gratis, en cualquier plan).

El cliente no compra software para instalar ni recibe código fuente: contrata **acceso** a una plataforma web (con usuario y contraseña) que Datum opera, mantiene y actualiza. Es un servicio de suscripción, no un desarrollo de software por encargo.

## Cómo empieza la relación con un cliente

1. **Diagnóstico inicial**: una conversación con el dueño del negocio para entender cómo vende, qué controla hoy y qué necesita.
2. Con base en eso, Datum crea la cuenta del cliente (empresa, módulos activos según el plan elegido, y datos de la suscripción) en un solo paso desde un panel interno.
3. Se le envía por correo el acceso (usuario y contraseña temporal, que debe cambiar en el primer ingreso). Toda cuenta nueva entra siempre a la misma pantalla de resumen del negocio — ya no varía según el tipo de cliente.
4. El cliente tiene un **período de prueba gratuita de 15 días calendario** desde la activación, sin costo y sin permanencia obligada durante ese período (puede cancelar sin preaviso ni penalidad). El cobro de la suscripción empieza al vencer ese período.

## Estructura comercial

- **Suscripción mensual pura**, sin cobro inicial de implementación ni de instalación.
- **Cuatro planes, vigentes desde 2026-08-27**, que se diferencian por cuántos módulos puede activar el cliente (el cliente elige cuáles, no es un paquete fijo). El panel de control (insights) no cuenta contra ese límite — va incluido gratis en los cuatro:

  | Plan | Módulos permitidos | Mensual |
  |---|---|---|
  | Basic | 1 módulo | $99.900 COP |
  | Startup | Hasta 3 módulos, a elección del cliente | $269.900 COP |
  | Pyme | Hasta 5 módulos, a elección del cliente | $399.900 COP |
  | Enterprise | Todos los módulos disponibles | $449.900 COP |

  Un cambio futuro de estos montos sigue siendo posible — si el abogado está trabajando sobre una versión más vieja de este documento, vale la pena confirmar la tabla vigente antes de redactar el Anexo de precios.
- **Descuento del 15% por pago anual**, frente al costo de pagar los 12 meses por separado.
- **Estos precios no incluyen IVA** — Datum opera hoy como No responsable de IVA (código 49 en el RUT). Si esa condición cambia en el futuro (por superar el umbral de ingresos anuales), queda pendiente decidir si los precios de la tabla absorben el IVA o se le suman al cliente.
- **Desarrollo a la medida para un cliente específico** (algo que requiera código nuevo, no cubierto por la configuración estándar de la plataforma) se cotiza y se cobra aparte de la suscripción, como un proyecto puntual. La forma de cotizar ese trabajo (por horas, por alcance fijo, etc.) **todavía no está definida**.
- **Cobros**: actualmente manuales — transferencia bancaria + factura de venta simple. No hay pasarela de pago ni débito automático integrado todavía (evaluando Wompi y Bold, sin elegir ninguna a la fecha de este documento).
- **Vigencia y renovación**: ya existe un borrador de contrato que fija una vigencia inicial de 12 meses desde la activación, con renovación automática por períodos iguales salvo aviso escrito de no renovar con al menos 30 días de anticipación al vencimiento. Ese borrador **todavía no ha sido revisado por un abogado colombiano habilitado** — es exactamente el insumo que se espera que el abogado valide o corrija.

## Qué NO incluye el servicio (por ahora)

- **Facturación electrónica ante la DIAN**: fuera de alcance todavía. El camino decidido es integrar el módulo de Ventas con un proveedor tecnológico ya habilitado por la DIAN (se están evaluando Factus, Alanube y Bilidox, bajo la modalidad de "casa de software"/multi-tenant, dado que Datum le presta el servicio a muchas empresas distintas) — Datum nunca sería el proveedor tecnológico directo ante la DIAN. Es deliberadamente el último módulo que se construye.
- **Pasarela de pagos / cobro automático recurrente**: todavía no conectada (ver arriba).
- **Multi-sede o "sucursales" bajo una sola cuenta**: **esto sí está construido** — un negocio con varios puntos de venta puede tener inventario y ventas separados por punto, bajo la misma cuenta y el mismo CRM. Es opcional, no todos los clientes lo necesitan.

## Dónde viven los datos del cliente

- La aplicación corre sobre infraestructura de terceros: **Supabase** (base de datos) y **Vercel** (hosting) — proveedores externos, no servidores propios de Datum. Pendiente confirmar la región exacta donde cada uno almacena/procesa los datos (se revisa desde el panel de cada proveedor), para cerrar la Política de Tratamiento de Datos.
- Cada empresa cliente ve únicamente sus propios datos (aislamiento a nivel de base de datos, Row Level Security); Datum como operador de la plataforma tiene acceso administrativo para dar soporte y mantenimiento.
- Ya existe un borrador de **Política de Tratamiento de Datos Personales** (Ley 1581 de 2012 / Decreto 1377 de 2013), con Datum como Encargado y cada empresa cliente como Responsable de los datos de sus propios clientes finales (nombre, teléfono, correo, historial de compras). Ese borrador también está pendiente de revisión por un abogado colombiano habilitado.

## Estado legal de Datum

- Opera hoy con RUT como persona natural (No responsable de IVA) — **pendiente confirmar con Andrés** si ya está formalizado adicionalmente como empresa (Cámara de Comercio) o si sigue operando como persona natural para todo efecto contractual; no asumir uno u otro sin confirmarlo.
- El contrato prevé habilitación de firma electrónica (Ley 527 de 1999), pero **todavía no se ha elegido un proveedor** que la ejecute.

## Lo que se le pediría al abogado

1. Revisar (no redactar desde cero — ya existen borradores) el contrato base de prestación de servicios y la Política de Tratamiento de Datos Personales, ambos escritos por el propio equipo de Datum como punto de partida.
2. Confirmar si la tabla de planes y precios de este documento necesita algún ajuste legal antes de quedar en firme en el Anexo No. 1 del contrato.
3. Aclarar qué tan expuesto queda Datum si el cliente pierde información por una falla de un proveedor externo (Supabase/Vercel) — es decir, hasta dónde llega la responsabilidad de Datum como operador vs. la de esos proveedores.
4. Una cláusula clara para el "desarrollo a la medida" cobrado aparte, ya que es un servicio distinto a la suscripción mensual.
5. Recomendar un proveedor de firma electrónica para ejecutar la cláusula ya prevista en el contrato.
