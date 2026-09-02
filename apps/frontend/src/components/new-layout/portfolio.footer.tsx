import {
  CODESTRA_PRODUCT_NETWORK,
  SOCIAL_DOMAINS,
} from '@gitroom/frontend/config/portfolio';

const year = new Date().getFullYear();

export function PortfolioFooter() {
  return (
    <footer className="hz-social-footer">
      <div className="hz-social-footer__inner">
        <section className="hz-social-footer__brand" aria-labelledby="social-footer-title">
          <p className="hz-social-footer__eyebrow">Codestra product network</p>
          <h2 id="social-footer-title" className="hz-social-footer__title">
            One social workspace. Clear publishing state.
          </h2>
          <p className="hz-social-footer__copy">
            Plan, create, schedule, and review social content while publishing
            capability, billing, integrations, and provider state remain explicit.
          </p>
          <div className="hz-social-domains" aria-label="Codestra Social domains">
            <a className="hz-social-domain-chip" href={SOCIAL_DOMAINS.public}>
              social.codestra.co
            </a>
            <a className="hz-social-domain-chip" href={SOCIAL_DOMAINS.identity}>
              auth.codestra.co
            </a>
            <a className="hz-social-domain-chip" href={SOCIAL_DOMAINS.api}>
              api.codestra.co
            </a>
          </div>
        </section>

        <nav aria-label="Social workspace">
          <h3 className="hz-social-footer__heading">Workspace</h3>
          <ul className="hz-social-footer__links">
            <li><a className="hz-social-footer__link" href="/launches">Publishing calendar</a></li>
            <li><a className="hz-social-footer__link" href="/analytics">Analytics</a></li>
            <li><a className="hz-social-footer__link" href="/integrations">Integrations</a></li>
            <li><a className="hz-social-footer__link" href="/settings">Settings</a></li>
          </ul>
        </nav>

        <nav aria-label="Platform trust">
          <h3 className="hz-social-footer__heading">Trust</h3>
          <ul className="hz-social-footer__links">
            <li><a className="hz-social-footer__link" href="/legal/open-source">Open-source notices</a></li>
            <li><a className="hz-social-footer__link" href={`${SOCIAL_DOMAINS.corporate}/privacy`}>Privacy</a></li>
            <li><a className="hz-social-footer__link" href={`${SOCIAL_DOMAINS.corporate}/contact`}>Support</a></li>
          </ul>
        </nav>

        <nav aria-label="Codestra products">
          <h3 className="hz-social-footer__heading">Products</h3>
          <ul className="hz-social-footer__links">
            {CODESTRA_PRODUCT_NETWORK.map((product) => (
              <li key={product.href}>
                <a className="hz-social-footer__link" href={product.href}>
                  {product.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hz-social-footer__bottom">
          <span>© {year} Codestra Social. Operated by Codestra.</span>
          <a className="hz-social-footer__link" href={SOCIAL_DOMAINS.corporate}>
            codestra.co
          </a>
        </div>
      </div>
    </footer>
  );
}
