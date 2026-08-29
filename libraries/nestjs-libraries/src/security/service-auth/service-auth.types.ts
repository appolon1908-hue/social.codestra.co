export type ServiceTokenClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  nbf?: number;
  iat?: number;
  azp?: string;
  client_id?: string;
  tenant_id: string;
  scope?: string;
};

export type ServiceAuthContext = {
  subject: string;
  clientId: string;
  tenantId: string;
  scopes: string[];
  correlationId: string;
  claims: ServiceTokenClaims;
};
