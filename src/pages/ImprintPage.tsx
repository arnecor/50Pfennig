/**
 * pages/ImprintPage.tsx
 *
 * Route: /account/imprint
 *
 * Imprint + privacy policy page (Impressum & Datenschutz).
 */

import { PageHeader } from '@/components/shared/PageHeader';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

function PrivacyPolicyContent() {
  const [html, setHtml] = useState('');

  useEffect(() => {
    fetch('/impressum.html')
      .then((r) => r.text())
      .then(setHtml)
      .catch(() => {});
  }, []);

  if (!html) return null;

  return (
    <div
      // biome-ignore lint/security/noDangerouslySetInnerHtml: content is a static local asset we control
      dangerouslySetInnerHTML={{ __html: html }}
      className="
        [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mb-3 [&_h1]:text-foreground
        [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-foreground
        [&_h3]:text-xs [&_h3]:font-medium [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-foreground
        [&_p]:text-muted-foreground [&_p]:mb-2 [&_p]:leading-relaxed
        [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:mb-2
        [&_li]:text-muted-foreground [&_li]:mb-1 [&_li]:leading-relaxed
        [&_strong]:font-semibold [&_strong]:text-foreground
        [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
        [&_.index]:hidden
      "
    />
  );
}

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
          <p className="font-medium">Sharli</p>
          <p className="text-muted-foreground">{t('account.imprint_version_placeholder')}</p>
        </section>

        {/* Responsible person */}
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

        {/* Privacy policy */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            {t('account.imprint_section_privacy')}
          </h2>
          <PrivacyPolicyContent />
        </section>
      </div>
    </div>
  );
}
