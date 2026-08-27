import { CodestraHttpClient } from './client';
import {
  AcceptedCommand,
  CodestraRequestOptions,
  JsonObject,
  Query,
} from './types';
class Resource {
  constructor(protected readonly http: CodestraHttpClient) {}
}
export class CollectionResource extends Resource {
  constructor(http: CodestraHttpClient, private readonly path: string) {
    super(http);
  }
  list<T = JsonObject>(query?: Query, options?: CodestraRequestOptions) {
    return this.http.request<T>('GET', this.path, undefined, query, options);
  }
  get<T = JsonObject>(id: string, options?: CodestraRequestOptions) {
    return this.http.request<T>(
      'GET',
      `${this.path}/${encodeURIComponent(id)}`,
      undefined,
      undefined,
      options
    );
  }
  create<T = AcceptedCommand>(
    body: JsonObject,
    options?: CodestraRequestOptions
  ) {
    return this.http.request<T>('POST', this.path, body, undefined, options);
  }
  update<T = AcceptedCommand>(
    id: string,
    body: JsonObject,
    options?: CodestraRequestOptions
  ) {
    return this.http.request<T>(
      'PATCH',
      `${this.path}/${encodeURIComponent(id)}`,
      body,
      undefined,
      options
    );
  }
}
export class CodestraActions extends Resource {
  command<T = AcceptedCommand>(
    path: string,
    body: JsonObject,
    options?: CodestraRequestOptions
  ) {
    return this.http.request<T>('POST', path, body, undefined, options);
  }
  query<T = JsonObject>(
    path: string,
    query?: Query,
    options?: CodestraRequestOptions
  ) {
    return this.http.request<T>('GET', path, undefined, query, options);
  }
}
