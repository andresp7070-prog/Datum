// Texto del contrato — ver schema.sql, sección "ACEPTACIÓN DEL CONTRATO
// DENTRO DE LA PLATAFORMA" y CLAUDE.md. Transcrito de
// Contrato_Datum_Prestacion_Servicios_SaaS.docx (versión subida
// 2026-10-26), quitando la nota de uso interno (no hace parte del
// contrato) y las líneas de firma física al final (acá la "firma" es
// electrónica — ver Cláusula Décima Octava, numeral 18.6 — y la arma
// page.tsx junto con el botón "Acepto"). El Anexo No. 1 de ese archivo
// traía la tabla de planes vieja (Startup/Pyme/Enterprise, precios de
// antes de agosto de 2026) — PLANES_VIGENTES abajo ya tiene los 4 planes
// y precios actuales, los mismos de landing.tsx y de "Crear cliente".
//
// Bump VERSION_CONTRATO (fecha ISO del día del cambio) cada vez que se
// edite el texto de este archivo — queda guardado en
// empresas.terminos_version junto a la fecha de aceptación, para saber
// exactamente qué versión aceptó cada cliente si el contrato cambia.
export const VERSION_CONTRATO = "2026-10-26";

export const PLANES_VIGENTES = [
  { value: "basic", nombre: "Basic", modulos: "1 módulo, a elección de EL CLIENTE", precio: 199000 },
  { value: "startup", nombre: "Startup", modulos: "Hasta 3 módulos, a elección de EL CLIENTE", precio: 409000 },
  { value: "pyme", nombre: "Pyme", modulos: "Hasta 5 módulos, a elección de EL CLIENTE", precio: 649000 },
  { value: "enterprise", nombre: "Enterprise", modulos: "Todos los módulos disponibles en la Plataforma", precio: 799000 },
] as const;

export const MODULOS_CONTRATO = [
  { value: "ventas", label: "Ventas" },
  { value: "crm", label: "CRM" },
  { value: "inventario", label: "Inventario" },
  { value: "pyg", label: "Estado de Resultados" },
  { value: "nomina", label: "Nómina" },
  { value: "promociones", label: "Promociones" },
  { value: "insights", label: "Paneles de control / Insights" },
] as const;

function formatoCOP(valor: number) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

export function ContratoCompleto({
  empresaNombre,
  nit,
  ciudad,
  representanteNombre,
  representanteCC,
  plan,
  modulosActivos,
  montoMensual,
  facturacion,
}: {
  empresaNombre: string;
  nit: string | null;
  ciudad: string | null;
  representanteNombre: string | null;
  representanteCC: string | null;
  plan: string | null;
  modulosActivos: string[];
  montoMensual: number | null;
  facturacion: string | null;
}) {
  const planInfo = PLANES_VIGENTES.find((p) => p.value === plan) ?? null;

  return (
    <article className="space-y-6 text-sm leading-relaxed text-gray-700">
      <h1 className="text-center text-base font-bold text-gray-900">
        CONTRATO DE PRESTACIÓN DE SERVICIOS DE IMPLEMENTACIÓN Y LICENCIA DE USO DE PLATAFORMA
        SAAS
      </h1>

      <p>
        Entre los suscritos, a saber: de una parte, EDGAR ANDRÉS PEÑA LÓPEZ, mayor de edad,
        identificado con cédula de ciudadanía No. 1.018.470.860 expedida en Bogotá D.C., quien
        actúa en nombre propio, en su calidad de persona natural comerciante, identificado con
        Número de Identificación Tributaria (NIT) 1.018.470.860-1, con domicilio en la ciudad de
        Bogotá D.C., y quien para efectos comerciales utiliza el nombre comercial &quot;DATUM&quot;,
        quien en adelante y para efectos del presente contrato se denominará EL PRESTADOR o
        DATUM; y de otra parte, <strong>{empresaNombre}</strong>
        {nit && (
          <>
            , identificada con NIT o cédula de ciudadanía No. <strong>{nit}</strong>
          </>
        )}
        {ciudad && (
          <>
            , con domicilio en la ciudad de <strong>{ciudad}</strong>
          </>
        )}
        {representanteNombre && (
          <>
            , representada legalmente en este acto por <strong>{representanteNombre}</strong>
            {representanteCC && (
              <>
                , mayor de edad, identificado(a) con cédula de ciudadanía No.{" "}
                <strong>{representanteCC}</strong>
              </>
            )}
          </>
        )}
        , quien en adelante se denominará EL CLIENTE; quienes en conjunto se denominarán LAS
        PARTES, hemos acordado celebrar el presente Contrato de Prestación de Servicios de
        Implementación y Licencia de Uso de Plataforma SaaS (en adelante, el &quot;Contrato&quot;), el cual
        se regirá por las cláusulas que se relacionan más adelante, previas las siguientes
        consideraciones:
      </p>

      <h2 className="font-bold text-gray-900">CONSIDERACIONES</h2>
      <p>
        PRIMERA. Que EL PRESTADOR es una persona natural dedicada a la prestación de servicios de
        asesoría empresarial y al desarrollo, operación y licenciamiento de una plataforma
        tecnológica bajo el modelo de Software como Servicio (SaaS), dirigida a pequeñas y
        medianas empresas colombianas, que integra módulos de ventas, gestión de relacionamiento
        con clientes (CRM), inventario, estado de resultados, nómina, promociones y paneles de
        control, entre otros.
      </p>
      <p>
        SEGUNDA. Que el servicio de EL PRESTADOR se estructura en cuatro (4) fases sucesivas: (i)
        una Reunión Inicial con el cliente para conocer sus necesidades; (ii) propuesta comercial
        y suscripción del contrato correspondiente; (iii) implementación y configuración de la
        Plataforma; y (iv) suscripción para el uso continuado de la Plataforma.
      </p>
      <p>
        TERCERA. Que, como resultado de la Reunión Inicial sostenida entre EL PRESTADOR y EL
        CLIENTE, las partes identificaron el plan y los módulos descritos en el Anexo No. 1 de
        este Contrato como los más adecuados para las necesidades de EL CLIENTE.
      </p>
      <p>
        CUARTA. Que EL CLIENTE ha manifestado su interés en contratar los servicios de EL
        PRESTADOR bajo los términos y condiciones que se establecen en este documento.
      </p>
      <p>
        En virtud de lo anterior, las partes acuerdan celebrar el presente Contrato, el cual se
        regirá por las siguientes:
      </p>

      <h2 className="font-bold text-gray-900">CLÁUSULAS</h2>

      <h3 className="font-semibold text-gray-900">CLÁUSULA PRIMERA. DEFINICIONES.</h3>
      <p>
        Para efectos de la interpretación y ejecución del presente Contrato, los siguientes
        términos, cuando se usen con mayúscula inicial, tendrán el significado que aquí se les
        asigna:
      </p>
      <ul className="list-[lower-alpha] space-y-2 pl-5">
        <li>
          Reunión Inicial: la reunión sostenida entre EL PRESTADOR y EL CLIENTE, previa a la firma
          de este Contrato, para conocer las necesidades de EL CLIENTE y definir el Plan
          Contratado y los Módulos Seleccionados. Esta reunión no constituye una auditoría, un
          diagnóstico técnico ni un análisis financiero formal del negocio de EL CLIENTE.
        </li>
        <li>
          Plataforma: el software como servicio (SaaS) de titularidad de EL PRESTADOR, mediante el
          cual EL CLIENTE accede a los Módulos Seleccionados conforme al Plan Contratado.
        </li>
        <li>
          Plan Contratado: el nivel de servicio (Basic, Startup, Pyme o Enterprise) seleccionado
          por EL CLIENTE, el cual determina el número de módulos a los que EL CLIENTE puede
          acceder y el valor de la Cuota de Suscripción, según el Anexo No. 1.
        </li>
        <li>
          Módulos Seleccionados: los módulos específicos que, dentro del límite permitido por el
          Plan Contratado, EL CLIENTE elige de entre los disponibles en la Plataforma, y que se
          detallan en el Anexo No. 1.
        </li>
        <li>
          Datos del Cliente: la información comercial, financiera, de inventario y de clientes que
          EL CLIENTE cargue, genere o almacene en la Plataforma en desarrollo de este Contrato.
        </li>
        <li>
          Fase de Implementación: el período durante el cual EL PRESTADOR configura la Plataforma
          y capacita a EL CLIENTE para su uso, conforme a la Cláusula Sexta.
        </li>
        <li>
          Fase de Suscripción: el período de uso continuado de la Plataforma por parte de EL
          CLIENTE, sujeto al pago de la Cuota de Suscripción una vez vencido el Período de Prueba
          Gratuita.
        </li>
        <li>
          Período de Prueba Gratuita: los primeros quince (15) días calendario contados desde la
          fecha de activación de la Plataforma, durante los cuales EL CLIENTE podrá usarla sin
          costo, conforme a la Cláusula Quinta.
        </li>
      </ul>

      <h3 className="font-semibold text-gray-900">CLÁUSULA SEGUNDA. OBJETO.</h3>
      <p>
        EL PRESTADOR se obliga para con EL CLIENTE, a título oneroso, de manera independiente y
        sin que se genere relación laboral ni de subordinación entre las partes ni con el personal
        que cada una designe, a prestar los siguientes servicios: (i) la Reunión Inicial; (ii)
        implementación y configuración de la Plataforma conforme al Plan Contratado y los Módulos
        Seleccionados; y (iii) licenciamiento no exclusivo, intransferible y limitado de uso de la
        Plataforma durante la vigencia de la Fase de Suscripción, todo de conformidad con los
        términos, alcance y condiciones descritos en este Contrato y en su Anexo No. 1.
      </p>
      <p>
        Parágrafo. La Plataforma no incluye, en su versión actual, funcionalidad de facturación
        electrónica ante la Dirección de Impuestos y Aduanas Nacionales (DIAN). EL CLIENTE
        conserva la responsabilidad exclusiva e indelegable de dar cumplimiento a sus obligaciones
        tributarias, contables y de facturación conforme a la normativa vigente, de manera
        independiente a los servicios prestados bajo este Contrato.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA TERCERA. METODOLOGÍA DEL SERVICIO.</h3>
      <p>El servicio contratado se presta conforme a la siguiente metodología de cuatro (4) fases:</p>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Reunión Inicial: conforme a la definición de la Cláusula Primera, sostenida previamente
          a la firma de este Contrato, cuyo resultado determinó el Plan Contratado y los Módulos
          Seleccionados.
        </li>
        <li>
          Propuesta y contratación: formalización de las condiciones comerciales mediante la
          suscripción de este Contrato y su Anexo No. 1.
        </li>
        <li>
          Implementación: configuración de la Plataforma, migración de información inicial cuando
          aplique, y capacitación al personal que EL CLIENTE designe, conforme al plazo indicado
          en la Cláusula Sexta, sin costo adicional al valor de la Cuota de Suscripción.
        </li>
        <li>
          Suscripción: uso continuado de la Plataforma por parte de EL CLIENTE durante la vigencia
          del Contrato —incluyendo el Período de Prueba Gratuita—, con acceso a soporte según lo
          previsto en la Cláusula Décima Segunda.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA CUARTA. PLAN CONTRATADO Y ALCANCE.</h3>
      <p>
        EL CLIENTE contrata el plan marcado en el Anexo No. 1 (Ficha Técnica del Plan Contratado),
        documento que hace parte integral del presente Contrato y que detalla el número de
        módulos permitidos según el Plan Contratado, los Módulos Seleccionados por EL CLIENTE
        dentro de dicho límite, y el valor de la Cuota de Suscripción mensual correspondiente. La
        adición de módulos más allá del límite del Plan Contratado, o el cambio a un plan de mayor
        o menor alcance, se entenderá fuera del alcance de este Contrato y deberá acordarse por
        escrito entre las partes, incluyendo el ajuste correspondiente al valor del servicio. Los
        Módulos Seleccionados dentro del mismo Plan Contratado podrán ajustarse de mutuo acuerdo
        entre las partes al momento de la renovación de la Fase de Suscripción.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA QUINTA. VALOR Y FORMA DE PAGO.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Período de Prueba Gratuita. EL CLIENTE contará con un Período de Prueba Gratuita de
          quince (15) días calendario, contado a partir de la fecha de activación de la
          Plataforma, durante el cual podrá usarla sin costo. Durante el Período de Prueba
          Gratuita, EL CLIENTE podrá terminar este Contrato en cualquier momento, sin necesidad de
          preaviso ni penalidad alguna, mediante aviso escrito a EL PRESTADOR.
        </li>
        <li>
          Condiciones del Período de Prueba Gratuita. El Período de Prueba Gratuita solo aplica
          una única vez por EL CLIENTE. Si EL CLIENTE cancela el Contrato durante o al finalizar
          dicho período y posteriormente contrata nuevamente los servicios de EL PRESTADOR, no
          tendrá derecho a un nuevo Período de Prueba Gratuita. EL PRESTADOR se reserva el derecho
          de otorgar o negar el Período de Prueba Gratuita a su entera discreción, sin que ello
          genere responsabilidad alguna a su cargo, en los términos permitidos por la ley.
        </li>
        <li>
          Primer Cobro. Vencido el Período de Prueba Gratuita, EL CLIENTE pagará a EL PRESTADOR,
          de manera anticipada, un primer cobro correspondiente a los quince (15) días restantes
          del primer mes de servicio, equivalente al cincuenta por ciento (50%) de la Cuota de
          Suscripción mensual del Plan Contratado. Realizado dicho pago, EL CLIENTE quedará al día
          con el primer mes completo de servicio (Período de Prueba Gratuita más el período
          cubierto por el primer cobro), y en adelante se facturará la Cuota de Suscripción
          completa conforme al numeral 5.4.
        </li>
        <li>
          Cuota de Suscripción. A partir del segundo mes de servicio, EL CLIENTE pagará a EL
          PRESTADOR, de manera anticipada y según la modalidad de facturación elegida conforme al
          numeral 5.5, el valor completo indicado en el Anexo No. 1 para el Plan Contratado,
          durante toda la vigencia de la Fase de Suscripción. El servicio no contempla cobro
          adicional por concepto de implementación.
        </li>
        <li>
          Modalidad de facturación. EL CLIENTE podrá optar por facturación mensual o facturación
          anual. En caso de optar por facturación anual, se aplicará un descuento del quince por
          ciento (15%) sobre el valor resultante de multiplicar por doce (12) la Cuota de
          Suscripción mensual del Plan Contratado. La modalidad elegida se indicará en el Anexo
          No. 1 y podrá modificarse de mutuo acuerdo al momento de la renovación.
        </li>
        <li>
          Moneda e impuestos. Todos los valores se expresan en pesos colombianos (COP). A la fecha
          de firma de este Contrato, EL PRESTADOR tiene la calidad de &quot;No responsable de
          IVA&quot; conforme a su Registro Único Tributario (RUT), por lo cual los valores
          indicados en este Contrato y en el Anexo No. 1 no incluyen dicho impuesto. Si EL
          PRESTADOR llegare a adquirir la calidad de responsable de IVA durante la vigencia de
          este Contrato, dicho impuesto se adicionará a los valores pactados a partir de la fecha
          en que dicha condición surta efecto, previo aviso escrito a EL CLIENTE.
        </li>
        <li>
          Forma de pago. Los pagos se realizarán mediante transferencia bancaria a la cuenta que
          EL PRESTADOR indique, dentro de los cinco (5) días hábiles siguientes a la fecha de la
          cuenta de cobro correspondiente. EL PRESTADOR podrá habilitar en el futuro una pasarela
          de pagos electrónica como medio adicional o alternativo, lo cual informará a EL CLIENTE
          con antelación razonable.
        </li>
        <li>
          Mora. En caso de retardo en el pago de cualquier suma a cargo de EL CLIENTE, este
          reconocerá a EL PRESTADOR intereses de mora a la tasa máxima legal permitida en
          Colombia, calculados desde la fecha de exigibilidad hasta la fecha de pago efectivo.
        </li>
        <li>
          Suspensión por no pago. EL PRESTADOR podrá suspender el acceso de EL CLIENTE a la
          Plataforma si cualquier suma adeudada conforme a esta cláusula no se paga dentro de los
          diez (10) días calendario siguientes a su vencimiento, previo aviso escrito con cinco
          (5) días de antelación, sin perjuicio de las demás acciones legales a que haya lugar.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA SEXTA. PLAZO Y DURACIÓN.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          La Fase de Implementación tendrá una duración estimada de quince (15) días hábiles,
          contados a partir de la firma de este Contrato, plazo que podrá ajustarse de mutuo
          acuerdo según la disponibilidad de información de EL CLIENTE.
        </li>
        <li>
          La Fase de Suscripción tendrá una vigencia inicial de doce (12) meses contados a partir
          de la fecha de activación de la Plataforma, y se renovará automáticamente por períodos
          iguales y sucesivos, salvo que cualquiera de las partes manifieste por escrito su
          intención de no renovar, con una antelación mínima de treinta (30) días al vencimiento
          del período en curso.
        </li>
        <li>
          EL PRESTADOR podrá ajustar el valor de la Cuota de Suscripción para los períodos de
          renovación, previo aviso escrito a EL CLIENTE con una antelación mínima de treinta (30)
          días al inicio del nuevo período. Si EL CLIENTE no está de acuerdo con el nuevo valor,
          podrá optar por no renovar el Contrato conforme al numeral 6.2.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA SÉPTIMA. OBLIGACIONES DE EL PRESTADOR.</h3>
      <p>Además de las obligaciones que se derivan de la naturaleza de este Contrato y de la ley, EL PRESTADOR se obliga a:</p>
      <ul className="list-[lower-alpha] space-y-2 pl-5">
        <li>Realizar la implementación y configuración de la Plataforma conforme al Plan Contratado y los Módulos Seleccionados, dentro del plazo acordado.</li>
        <li>Capacitar al personal designado por EL CLIENTE en el uso de los Módulos Seleccionados.</li>
        <li>Mantener la Plataforma en condiciones razonables de funcionamiento, realizando los mantenimientos y actualizaciones que sean necesarios.</li>
        <li>Brindar el soporte descrito en la Cláusula Décima Segunda.</li>
        <li>Adoptar medidas técnicas, humanas y administrativas razonables para proteger los Datos del Cliente conforme a la Cláusula Décima.</li>
        <li>Informar a EL CLIENTE con antelación razonable sobre mantenimientos programados que puedan afectar la disponibilidad de la Plataforma.</li>
      </ul>

      <h3 className="font-semibold text-gray-900">CLÁUSULA OCTAVA. OBLIGACIONES DE EL CLIENTE.</h3>
      <p>Además de las obligaciones que se derivan de la naturaleza de este Contrato y de la ley, EL CLIENTE se obliga a:</p>
      <ul className="list-[lower-alpha] space-y-2 pl-5">
        <li>Pagar oportunamente los valores pactados en la Cláusula Quinta.</li>
        <li>Suministrar a EL PRESTADOR la información necesaria y veraz para la Fase de Implementación, dentro de los plazos que se le indiquen.</li>
        <li>Designar al menos una persona de contacto para efectos de la implementación, capacitación y soporte.</li>
        <li>Usar la Plataforma exclusivamente para los fines lícitos propios de su actividad comercial, absteniéndose de todo uso indebido, fraudulento o contrario a la ley.</li>
        <li>Mantener la confidencialidad de las credenciales de acceso asignadas a sus usuarios, y responder por el uso que estos hagan de la Plataforma.</li>
        <li>Cumplir con sus propias obligaciones legales, tributarias y de facturación, las cuales son independientes y no son asumidas por EL PRESTADOR.</li>
      </ul>

      <h3 className="font-semibold text-gray-900">CLÁUSULA NOVENA. PROPIEDAD INTELECTUAL.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          EL PRESTADOR es y continuará siendo el único titular de todos los derechos de propiedad
          intelectual e industrial sobre la Plataforma, incluyendo, sin limitación, el software,
          código fuente, metodología de trabajo, diseños, marcas y demás elementos que la
          componen. Este Contrato no transfiere a EL CLIENTE ningún derecho de propiedad sobre
          dichos elementos, sino únicamente un derecho de uso personal, no exclusivo e
          intransferible, limitado a la vigencia de la Fase de Suscripción.
        </li>
        <li>
          Los Datos del Cliente son y seguirán siendo de exclusiva propiedad de EL CLIENTE. EL
          PRESTADOR únicamente está autorizado a acceder, procesar y usar los Datos del Cliente en
          la medida en que sea necesario para la prestación del servicio objeto de este Contrato.
        </li>
        <li>
          Para desarrollar y prestar funcionalidades de análisis, proyecciones y comparación de
          mercado (incluyendo el módulo de Proyecciones e Insights), así como para mejorar la
          Plataforma y sus algoritmos, EL PRESTADOR podrá utilizar los Datos del Cliente de forma
          conjunta y agregada con los de otros clientes de la Plataforma. En el desarrollo de
          dichas funcionalidades, EL PRESTADOR no revelará a otros clientes ni a terceros
          información específica que permita identificar individualmente a EL CLIENTE, ni revelará
          a EL CLIENTE información específica que permita identificar individualmente a otro
          cliente de la Plataforma.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA. TRATAMIENTO DE DATOS PERSONALES.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          En desarrollo de este Contrato, EL PRESTADOR podrá tener acceso a datos personales de
          clientes, empleados o proveedores de EL CLIENTE que este último registre en la
          Plataforma (por ejemplo, en el módulo de CRM). Para efectos de la Ley 1581 de 2012, el
          Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y las demás normas que los
          adicionen, modifiquen o reglamenten, EL CLIENTE actuará como Responsable del Tratamiento
          de dichos datos personales, y EL PRESTADOR actuará como Encargado del Tratamiento.
        </li>
        <li>
          EL CLIENTE declara y garantiza que cuenta con las autorizaciones necesarias de los
          titulares de los datos personales que registre en la Plataforma, y que dicho registro se
          ajusta a la política de tratamiento de datos personales que le sea aplicable.
        </li>
        <li>
          EL PRESTADOR se obliga a: (i) dar Tratamiento a los datos personales exclusivamente para
          los fines de la prestación del servicio objeto de este Contrato; (ii) guardar
          confidencialidad sobre dichos datos; (iii) implementar medidas de seguridad razonables
          para evitar su adulteración, pérdida, consulta, uso o acceso no autorizado; y (iv)
          eliminar o devolver los datos personales tratados una vez finalice la relación
          contractual, salvo obligación legal de conservarlos.
        </li>
        <li>
          Las partes podrán suscribir un acuerdo específico de tratamiento de datos personales que
          desarrolle en mayor detalle lo aquí previsto, el cual, de existir, se entenderá
          incorporado a este Contrato.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA PRIMERA. CONFIDENCIALIDAD.</h3>
      <p>
        Las partes se obligan a mantener bajo estricta confidencialidad toda la información
        técnica, comercial, financiera y de cualquier otra naturaleza a la que tengan acceso con
        ocasión de la ejecución de este Contrato, y a no revelarla a terceros sin autorización
        previa y escrita de la otra parte, salvo que dicha información: (i) sea de dominio público
        sin culpa de la parte receptora; (ii) deba divulgarse por mandato legal o de autoridad
        competente; o (iii) ya fuera conocida por la parte receptora con anterioridad a este
        Contrato. Esta obligación permanecerá vigente durante la ejecución del Contrato y por un
        término de dos (2) años contados a partir de su terminación.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA SEGUNDA. NIVELES DE SERVICIO Y SOPORTE.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          EL PRESTADOR realizará sus mejores esfuerzos comercialmente razonables para mantener la
          Plataforma disponible de forma continua, sin perjuicio de las interrupciones necesarias
          por mantenimiento, actualizaciones, o causas atribuibles a los proveedores de
          infraestructura de hosting y base de datos de los cuales depende la Plataforma.
        </li>
        <li>
          EL PRESTADOR brindará dos niveles de soporte a EL CLIENTE: (i) soporte general, para
          consultas comerciales o de uso de la Plataforma, disponible por correo electrónico en
          horario hábil de lunes a viernes de 8:00 a.m. a 6:00 p.m. (hora de Colombia), con un
          tiempo de respuesta estimado de veinticuatro (24) horas hábiles; y (ii) soporte técnico,
          para fallas o errores que afecten el funcionamiento de la Plataforma, disponible las
          veinticuatro (24) horas del día, los siete (7) días de la semana.
        </li>
        <li>
          Los niveles de servicio descritos en esta cláusula podrán precisarse o ajustarse de
          mutuo acuerdo entre las partes mediante anexo o comunicación escrita.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA TERCERA. LIMITACIÓN DE RESPONSABILIDAD.</h3>
      <p>
        En la máxima medida permitida por la ley aplicable, la responsabilidad total de EL
        PRESTADOR frente a EL CLIENTE por cualquier reclamación derivada de este Contrato, sea
        contractual o extracontractual, no excederá el valor efectivamente pagado por EL CLIENTE a
        EL PRESTADOR durante los seis (6) meses anteriores al hecho que originó la reclamación. En
        ningún caso EL PRESTADOR será responsable por lucro cesante, pérdida de datos por causas
        ajenas a su culpa, pérdida de oportunidades de negocio, ni por daños indirectos o
        consecuenciales. Lo anterior no aplica a los daños causados por dolo o culpa grave de EL
        PRESTADOR, ni limita los derechos irrenunciables que la ley reconozca a EL CLIENTE.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA CUARTA. TERMINACIÓN.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Vencido el Período de Prueba Gratuita, este Contrato podrá terminarse por: (i) mutuo
          acuerdo entre las partes; (ii) vencimiento del plazo sin renovación, conforme a la
          Cláusula Sexta; (iii) incumplimiento grave de las obligaciones a cargo de cualquiera de
          las partes, que no sea subsanado dentro de los diez (10) días hábiles siguientes al
          requerimiento escrito de la parte cumplida; o (iv) decisión unilateral de EL CLIENTE,
          mediante aviso escrito con treinta (30) días de antelación.
        </li>
        <li>
          Terminado el Contrato por cualquier causa, EL PRESTADOR pondrá a disposición de EL
          CLIENTE, durante un período de treinta (30) días, los medios para exportar los Datos del
          Cliente en un formato estándar. Vencido dicho plazo, EL PRESTADOR podrá eliminar
          definitivamente los Datos del Cliente de la Plataforma, salvo obligación legal de
          conservación.
        </li>
      </ol>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA QUINTA. CESIÓN.</h3>
      <p>
        Ninguna de las partes podrá ceder total o parcialmente los derechos y obligaciones
        derivados de este Contrato sin el consentimiento previo y escrito de la otra parte, salvo
        cesión de EL PRESTADOR a una sociedad vinculada, subsidiaria o adquirente de su negocio,
        de lo cual se informará a EL CLIENTE.
      </p>

      <h3 className="font-semibold text-gray-900">
        CLÁUSULA DÉCIMA SEXTA. SOLUCIÓN DE CONTROVERSIAS Y LEY APLICABLE.
      </h3>
      <p>
        Este Contrato se regirá e interpretará conforme a las leyes de la República de Colombia.
        Toda controversia que surja entre las partes con ocasión de este Contrato será resuelta,
        en primer lugar, mediante arreglo directo entre las partes dentro de un plazo de quince
        (15) días hábiles. De no lograrse un acuerdo, las partes acudirán a los jueces ordinarios
        competentes de la ciudad de Bogotá D.C., a cuya jurisdicción se someten expresamente,
        renunciando a cualquier otro fuero que pudiera corresponderles.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA SÉPTIMA. NOTIFICACIONES.</h3>
      <p>
        Para efectos de este Contrato, las notificaciones entre las partes se entenderán
        válidamente efectuadas al ser enviadas a las siguientes direcciones de correo electrónico:
        EL PRESTADOR: andresp7070@gmail.com; EL CLIENTE: el correo con el que accede a la
        Plataforma. Cualquier cambio en estos datos deberá informarse por escrito a la otra parte.
      </p>

      <h3 className="font-semibold text-gray-900">CLÁUSULA DÉCIMA OCTAVA. DISPOSICIONES GENERALES.</h3>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Integralidad. Este Contrato, junto con su Anexo No. 1, constituye el acuerdo íntegro
          entre las partes sobre su objeto, y deja sin efecto cualquier acuerdo o negociación
          previa, verbal o escrita, sobre la misma materia.
        </li>
        <li>Modificaciones. Cualquier modificación a este Contrato deberá constar por escrito y estar firmada por ambas partes.</li>
        <li>
          Independencia de las cláusulas. Si alguna cláusula de este Contrato fuera declarada
          inválida o inexequible, las demás continuarán vigentes en lo que no dependan de aquella.
        </li>
        <li>
          Relación entre las partes. Este Contrato no genera relación laboral, de mandato, de
          agencia comercial ni de representación entre las partes.
        </li>
        <li>
          Mérito ejecutivo. Este Contrato, junto con las cuentas de cobro no pagadas y sus
          soportes, prestará mérito ejecutivo conforme a la ley colombiana.
        </li>
        <li>
          Firma electrónica. Este Contrato podrá suscribirse mediante firma electrónica, de
          conformidad con la Ley 527 de 1999 y las normas que la desarrollan, la cual tendrá la
          misma validez y fuerza vinculante que una firma manuscrita. Las partes aceptan que el
          Contrato así suscrito conste en un mensaje de datos con plena validez jurídica.
        </li>
      </ol>

      <p>
        Para constancia de lo anterior, y en señal de aceptación de todas y cada una de las
        cláusulas precedentes, EL CLIENTE suscribe el presente Contrato mediante firma
        electrónica, conforme al numeral 18.6 anterior, al presionar el botón &quot;Acepto&quot; al
        final de esta página.
      </p>

      <h2 className="text-center font-bold text-gray-900">ANEXO No. 1 — FICHA TÉCNICA DEL PLAN CONTRATADO</h2>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
        <p>
          <strong>Plan contratado por EL CLIENTE:</strong>{" "}
          {planInfo ? planInfo.nombre : "Sin definir"}
        </p>
        <div>
          <strong>Módulos Seleccionados:</strong>
          <ul className="mt-1 list-none space-y-1 pl-0">
            {MODULOS_CONTRATO.map((m) => (
              <li key={m.value}>
                {modulosActivos.includes(m.value) ? "☑" : "☐"} {m.label}
              </li>
            ))}
          </ul>
        </div>
        <p>
          <strong>Modalidad de facturación:</strong>{" "}
          {facturacion === "anual"
            ? "Anual (15% de descuento sobre el valor de 12 cuotas mensuales)"
            : "Mensual"}
        </p>
        {montoMensual != null && (
          <p>
            <strong>Cuota de Suscripción mensual pactada:</strong> {formatoCOP(montoMensual)} COP
          </p>
        )}
        <p>
          Período de Prueba Gratuita: 15 días calendario desde la fecha de activación, aplica una
          sola vez por cliente. Al finalizar (día 16), se cobra por adelantado un primer pago
          equivalente al 50% de la Cuota de Suscripción mensual (por los 15 días restantes del
          primer mes); desde el segundo mes se cobra la Cuota de Suscripción completa, también por
          adelantado.
        </p>
        <p className="text-xs text-gray-500">
          Nota: los valores no incluyen IVA (EL PRESTADOR es No responsable de IVA a la fecha de
          este Contrato). El servicio no tiene cobro de implementación aparte de la Cuota de
          Suscripción.
        </p>
      </div>
    </article>
  );
}
