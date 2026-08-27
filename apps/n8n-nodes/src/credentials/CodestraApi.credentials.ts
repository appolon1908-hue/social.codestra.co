export class CodestraApiCredentials {
  name = 'codestraApi';
  displayName = 'Codestra API';
  properties = [
    {
      displayName: 'API URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.codestra.co/v2/social',
    },
    {
      displayName: 'OAuth Access Token',
      name: 'accessToken',
      type: 'string',
      typeOptions: { password: true },
      default: '',
    },
    { displayName: 'Tenant ID', name: 'tenantId', type: 'string', default: '' },
  ];
}
