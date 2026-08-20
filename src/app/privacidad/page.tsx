import Link from "next/link";
import "../landing.css";

// Ver el comentario de src/app/terminos/page.tsx — mismo motivo (Google
// necesita una dirección web real para la política de privacidad en la
// pantalla de consentimiento de OAuth). Mismo texto que el diálogo de
// Privacidad en landing.tsx.
export const metadata = {
  title: "Política de privacidad — Datum",
};

export default function PrivacidadPage() {
  return (
    <div className="legal-standalone">
      <div className="wrap">
        <Link href="/" className="legal-volver">
          ← Volver a Datum
        </Link>
        <div className="legal-section">
          <h2>Política de privacidad</h2>
          <p className="legal-updated">Última actualización: enero de 2026</p>

          <h3>1. Qué datos recopilamos</h3>
          <p>
            Recopilamos la información que nos das al crear tu cuenta (nombre, correo, datos de
            tu empresa) y la que registras al usar la plataforma (ventas, clientes, inventario, y
            demás datos propios de tu negocio).
          </p>

          <h3>2. Cómo usamos tus datos</h3>
          <p>
            Usamos tus datos únicamente para prestarte el servicio: mostrarte tu información,
            generar tus reportes y mantener tu cuenta funcionando. No usamos tus datos de negocio
            para entrenar modelos ni para ningún fin distinto al de operar la plataforma.
          </p>

          <h3>3. Con quién compartimos tus datos</h3>
          <p>
            No vendemos ni compartimos tu información con terceros, salvo con proveedores
            necesarios para operar el servicio (por ejemplo, hosting o envío de correos) o
            cuando la ley nos obligue a hacerlo.
          </p>

          <h3>4. Seguridad de la información</h3>
          <p>
            Cada empresa solo puede ver sus propios datos dentro de la plataforma. Aplicamos
            medidas técnicas razonables para proteger tu información contra accesos no
            autorizados.
          </p>

          <h3>5. Tus derechos</h3>
          <p>
            De acuerdo con la Ley 1581 de 2012 de Colombia (Habeas Data), tienes derecho a
            conocer, actualizar, rectificar y solicitar la eliminación de tus datos personales.
            Puedes ejercer estos derechos escribiéndonos directamente.
          </p>

          <h3>6. Cambios a esta política</h3>
          <p>
            Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios
            importantes antes de que entren en vigencia.
          </p>

          <h3>7. Contacto</h3>
          <p>
            Para preguntas sobre esta política o para ejercer tus derechos, escríbenos a{" "}
            <a href="mailto:andresp7070@gmail.com">andresp7070@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
