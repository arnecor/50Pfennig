/**
 * pages/ImprintPage.tsx
 *
 * Route: /account/imprint
 *
 * Static imprint page (Impressum). Content is placeholder — replace with real data.
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

export default function ImprintPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="min-h-full pb-24 font-sans">
      <PageHeader title={t('account.imprint_title')} onBack={() => navigate({ to: '/account' })} />

      <div className="px-5 pt-4 space-y-6 text-sm text-foreground leading-relaxed">
        {/* App info */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t('account.imprint_section_app')}
          </h2>
          <p className="font-medium">50Pfennig</p>
          <p className="text-muted-foreground">{t('account.imprint_version_placeholder')}</p>
        </section>

        {/* Responsible person / company */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t('account.imprint_section_responsible')}
          </h2>
          <p>{t('account.imprint_name_placeholder')}</p>
          <p>{t('account.imprint_address_line1_placeholder')}</p>
          <p>{t('account.imprint_address_line2_placeholder')}</p>
          <p>{t('account.imprint_country_placeholder')}</p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t('account.imprint_section_contact')}
          </h2>
          <p>{t('account.imprint_email_placeholder')}</p>
        </section>

        {/* Legal notice */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            {t('account.imprint_section_legal')}
          </h2>
          <p className="text-muted-foreground">{t('account.imprint_legal_placeholder')}</p>
        </section>
      </div>
    </div>
  );
}
