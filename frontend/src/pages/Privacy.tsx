import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import LanguageSwitcher from '../components/ui/LanguageSwitcher'

export default function Privacy() {
  const { t } = useTranslation()

  return (
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1rem', background: 'var(--bg-primary)', borderRadius: 'var(--radius)', minHeight: '60vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
          <span className="material-symbols-rounded">arrow_back</span>
          {t('common.back', 'Volver al inicio')}
        </Link>
        <LanguageSwitcher />
      </div>

      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', marginBottom: '2rem' }}>
        {t('privacy.title', 'Política de Privacidad')}
      </h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('privacy.whatWeCollect', '¿Qué datos recopilamos?')}</h2>
        <p>{t('privacy.whatWeCollectText', 'Recopilamos los datos necesarios para el funcionamiento de la plataforma: nombre, correo electrónico, foto de perfil, ubicaciones de recogida y destino, e imágenes de los acarreos.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('privacy.howWeUse', '¿Cómo usamos tus datos?')}</h2>
        <p>{t('privacy.howWeUseText', 'Usamos tus datos únicamente para facilitar el servicio de acarreo: conectar clientes con conductores, procesar pagos, y mejorar la plataforma.')}</p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('privacy.yourRights', 'Tus derechos GDPR')}</h2>
        <p>{t('privacy.yourRightsText', 'Tienes derecho a acceder, rectificar, exportar y eliminar tus datos personales. Puedes gestionar estos derechos desde la sección de privacidad en tu perfil.')}</p>
        <Link to="/settings/gdpr" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem', padding: '0.75rem 1.5rem', background: 'var(--primary)', color: 'white', borderRadius: 'var(--radius-sm)', textDecoration: 'none', fontWeight: 600 }}>
          <span className="material-symbols-rounded">settings</span>
          {t('privacy.manageData', 'Gestionar mis datos')}
        </Link>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>{t('privacy.contact', 'Contacto')}</h2>
        <p>{t('privacy.contactText', 'Si tienes preguntas sobre tu privacidad, contáctanos a soporte@carglyn.com.')}</p>
      </section>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
        {t('privacy.lastUpdated', 'Última actualización: Julio 2026')}
      </p>
    </div>
  )
}
