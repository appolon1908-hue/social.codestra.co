import Link from 'next/link';
export const metadata = {
  title: 'Codestra Developers',
  description:
    'Build governed social integrations with Codestra SDKs, webhooks, and connectors.',
};
const packages = [
  [
    '@codestra/social-sdk',
    'Typed browser and Node.js client generated from the enterprise OpenAPI contract.',
  ],
  [
    '@codestra/webhook-sdk',
    'Constant-time signature verification, timestamp validation, rotation, and replay protection.',
  ],
  [
    '@codestra/connector-kit',
    'Fail-closed Middleware-only adapter framework for Odoo, n8n, Klyrow, and Telnexa.',
  ],
  [
    '@codestra/n8n-nodes',
    'Governed Codestra actions and normalized event triggers for n8n.',
  ],
];
export default function DevelopersPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-[#F7F8FA] px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-[#FFD700]">
          CODESTRA DEVELOPER PLATFORM
        </p>
        <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">
          One contract. Governed integrations. No direct system writes.
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-[#C9CBD1]">
          Integrate through Kong and Codestra Middleware with typed SDKs, signed
          events, idempotent commands, tenant isolation, and sandbox-first
          credentials.
        </p>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {packages.map(([name, description]) => (
            <section
              key={name}
              className="rounded-2xl border border-[#292B30] bg-[#111] p-6"
            >
              <h2 className="font-mono text-xl text-[#FFD700]">{name}</h2>
              <p className="mt-3 text-[#C9CBD1]">{description}</p>
            </section>
          ))}
        </div>
        <section className="mt-12 rounded-2xl border border-[#292B30] bg-[#111] p-6">
          <h2 className="text-2xl font-semibold">Quick start</h2>
          <pre className="mt-4 overflow-x-auto rounded-xl bg-black p-5 text-sm text-[#C9CBD1]">
            <code>{`import { CodestraSocial } from '@codestra/social-sdk';\n\nconst social = new CodestraSocial({\n  accessToken,\n  tenantId,\n});\n\nawait social.campaigns.create(payload, { idempotencyKey });`}</code>
          </pre>
        </section>
        <nav
          aria-label="Developer resources"
          className="mt-10 flex flex-wrap gap-4"
        >
          <Link
            className="rounded-full bg-[#FFD700] px-6 py-3 font-semibold text-black"
            href="/developers/openapi"
          >
            OpenAPI operations
          </Link>
          <a
            className="rounded-full border border-[#3A3A3A] px-6 py-3"
            href="https://api.codestra.co"
          >
            API status
          </a>
        </nav>
      </div>
    </main>
  );
}
