import Link from "next/link";
import "../landing.css";

// Página pública aparte (no un <dialog>) — existe únicamente para tener una
// dirección web real que se pueda dar como "Vínculo a las Condiciones del
// Servicio" en la pantalla de consentimiento de OAuth de Google (Google
// necesita poder visitarla directamente, no solo abrirla como un modal
// dentro de la landing). El texto es exactamente el mismo que ya se
// muestra en el diálogo de Términos de landing.tsx — si se actualiza uno,
// hay que actualizar el otro.
export const metadata = {
  title: "Términos y condiciones — Datum",
};

export default function TerminosPage() {
  return (
    <div className="legal-standalone">
      <div className="wrap">
        <Link href="/" className="legal-volver">
          ← Volver a Datum
        </Link>
        <div className="legal-section">
          <h2>Términos y condiciones</h2>
          <p className="legal-updated">Última actualización: enero de 2026</p>

          <h3>1. Aceptación de los términos</h3>
          <p>
            Al crear una cuenta o usar la plataforma Datum, aceptas estos términos y condiciones
            en su totalidad. Si no estás de acuerdo con alguno de ellos, no debes usar el
            servicio.
          </p>

          <h3>2. Descripción del servicio</h3>
          <p>
            Datum es una plataforma de gestión para empresas que incluye, según el plan
            contratado, módulos de ventas, CRM, inventario, estado de resultados, nómina y
            paneles de control, entre otros. Nos reservamos el derecho de agregar, modificar o
            retirar funcionalidades para mejorar el servicio.
          </p>

          <h3>3. Cuenta y responsabilidad del usuario</h3>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de
            toda la actividad que ocurra dentro de tu cuenta. Debes notificarnos de inmediato
            ante cualquier uso no autorizado.
          </p>

          <h3>4. Planes, pagos y facturación</h3>
          <p>
            El acceso a Datum se ofrece mediante suscripción mensual o anual, según el plan
            elegido. Los precios pueden ajustarse con previo aviso razonable. La cancelación no
            genera reembolsos por periodos ya facturados, salvo que la ley aplicable indique lo
            contrario.
          </p>

          <h3>5. Propiedad intelectual</h3>
          <p>
            El software, el diseño y la marca Datum son propiedad de sus creadores. Los datos
            que ingreses a la plataforma (ventas, clientes, inventario, etc.) siguen siendo tuyos
            en todo momento.
          </p>

          <h3>6. Limitación de responsabilidad</h3>
          <p>
            Datum se ofrece &ldquo;tal cual&rdquo;. Hacemos lo posible por mantener el servicio
            disponible y seguro, pero no garantizamos que esté libre de interrupciones o
            errores, y no somos responsables por decisiones de negocio tomadas con base en la
            información de la plataforma.
          </p>

          <h3>7. Cambios a estos términos</h3>
          <p>
            Podemos actualizar estos términos ocasionalmente. Te notificaremos de cambios
            importantes antes de que entren en vigencia.
          </p>

          <h3>8. Ley aplicable</h3>
          <p>Estos términos se rigen por las leyes de la República de Colombia.</p>

          <h3>9. Contacto</h3>
          <p>
            Para preguntas sobre estos términos, escríbenos a{" "}
            <a href="mailto:andresp7070@gmail.com">andresp7070@gmail.com</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
