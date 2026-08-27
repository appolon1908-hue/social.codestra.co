import {
  OPERATION_IDS,
  CONTRACT_VERSION,
} from '../../../../../sdk/src/generated/operations';
export const metadata = { title: 'Codestra API Operations' };
export default function OperationsPage() {
  return (
    <main className="min-h-screen bg-[#080808] px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="text-[#FFD700]">OpenAPI {CONTRACT_VERSION}</p>
        <h1 className="mt-3 text-4xl font-semibold">
          Enterprise API operations
        </h1>
        <p className="mt-4 text-[#C9CBD1]">
          Generated from the versioned contract. Mutations require correlation
          and idempotency identifiers.
        </p>
        <ul className="mt-8 grid gap-3 md:grid-cols-2">
          {OPERATION_IDS.map((operation) => (
            <li
              className="rounded-xl border border-[#292B30] bg-[#111] px-4 py-3 font-mono text-sm"
              key={operation}
            >
              {operation}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
