import { CodestraHttpClient } from './client';
import { CodestraActions, CollectionResource } from './resources';
import { CodestraClientOptions } from './types';
export * from './client';
export * from './resources';
export * from './types';
export * from './generated/operations';
export class CodestraSocial {
  readonly onboarding;
  readonly brands;
  readonly content;
  readonly approvals;
  readonly campaigns;
  readonly calendar;
  readonly publications;
  readonly engagement;
  readonly analytics;
  readonly reports;
  readonly billing;
  readonly integrations;
  readonly webhooks;
  readonly audit;
  readonly actions;
  constructor(options: CodestraClientOptions) {
    const http = new CodestraHttpClient(options);
    this.onboarding = new CollectionResource(http, '/onboarding');
    this.brands = new CollectionResource(http, '/brand-profiles');
    this.content = new CollectionResource(http, '/content/revisions');
    this.approvals = new CollectionResource(http, '/approvals');
    this.campaigns = new CollectionResource(http, '/campaigns');
    this.calendar = new CollectionResource(http, '/calendar');
    this.publications = new CollectionResource(http, '/publications');
    this.engagement = new CollectionResource(http, '/engagement');
    this.analytics = new CollectionResource(http, '/analytics');
    this.reports = new CollectionResource(http, '/reports');
    this.billing = new CollectionResource(http, '/billing');
    this.integrations = new CollectionResource(http, '/integrations');
    this.webhooks = new CollectionResource(http, '/webhooks');
    this.audit = new CollectionResource(http, '/audit');
    this.actions = new CodestraActions(http);
  }
}
export default CodestraSocial;
