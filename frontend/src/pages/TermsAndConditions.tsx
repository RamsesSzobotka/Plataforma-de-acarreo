import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function TermsAndConditions() {
  const { t } = useTranslation()

  return (
    <div className="page-container" style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '2rem 1rem',
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius)',
      minHeight: '60vh',
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--primary)' }}>
        <span className="material-symbols-rounded">arrow_back</span>
        {t('common.back', 'Volver al inicio')}
      </Link>

      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>
        {t('terms.title', 'Términos y Condiciones')}
      </h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.acceptance', 'Aceptación de los Términos')}</h2>
        <p>{t('terms.acceptanceText', 'Al utilizar la plataforma Carglyn, usted acepta los presentes Términos y Condiciones. Si no está de acuerdo con alguno de ellos, no debe utilizar nuestros servicios.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.service', 'Descripción del Servicio')}</h2>
        <p>{t('terms.serviceText', 'Carglyn es una plataforma tecnológica que conecta a clientes que necesitan servicios de acarreo con conductores independientes. La plataforma actúa como intermediario y no presta directamente los servicios de transporte.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.holdPayment', 'Retención y Liberación de Pagos')}</h2>
        <p>{t('terms.holdPaymentText', 'Cuando un conductor acepta un acarreo y el cliente confirma la entrega, Carglyn retiene el pago del cliente. El monto se libera al conductor una vez que el servicio ha sido completado exitosamente y ambas partes han confirmado. En caso de cancelación, el reembolso se procesa según las políticas de cancelación establecidas en la plataforma.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.commission', 'Comisión de la Plataforma')}</h2>
        <p>{t('terms.commissionText', 'Carglyn retiene una comisión del 10% (diez por ciento) sobre el monto final de cada acarreo realizado a través de la plataforma. El conductor recibe el 90% restante del monto acordado. Esta comisión cubre los costos operativos, de procesamiento de pagos y mantenimiento de la plataforma.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.illegal', 'Actividades Ilícitas')}</h2>
        <p>{t('terms.illegalText', 'Carglyn no se hace responsable por ningún negocio, actividad o contenido ilícito que los usuarios (clientes o conductores) puedan realizar a través de la plataforma. El usuario es el único responsable de asegurarse de que el servicio solicitado u ofrecido cumpla con todas las leyes y regulaciones aplicables. Carglyn se reserva el derecho de reportar cualquier actividad sospechosa a las autoridades competentes y suspender cuentas involucradas en actividades ilícitas.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.liability', 'Limitación de Responsabilidad')}</h2>
        <p>{t('terms.liabilityText', 'Carglyn actúa únicamente como intermediario tecnológico y no es responsable por: daños a la mercancía, incumplimiento del conductor, retrasos en la entrega, pérdidas económicas derivadas del servicio, o cualquier disputa entre cliente y conductor. La responsabilidad de Carglyn se limita al valor de la comisión cobrada por el servicio específico en disputa.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.privacy', 'Privacidad y Datos')}</h2>
        <p>{t('terms.privacyText', 'El tratamiento de sus datos personales se rige por nuestra Política de Privacidad, la cual forma parte integral de estos Términos y Condiciones.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.modifications', 'Modificaciones')}</h2>
        <p>{t('terms.modificationsText', 'Carglyn se reserva el derecho de modificar estos términos en cualquier momento. Los cambios entrarán en vigor inmediatamente después de su publicación en la plataforma. El uso continuado de la plataforma después de cualquier modificación constituye la aceptación de los nuevos términos.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('terms.contact', 'Contacto')}</h2>
        <p>{t('terms.contactText', 'Para consultas sobre estos términos, contáctenos a: soporte@carglyn.com')}</p>
      </section>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {t('terms.lastUpdated', 'Última actualización: Julio 2026')}
      </p>
    </div>
  )
}
