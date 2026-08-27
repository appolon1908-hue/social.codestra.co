'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { Input } from '@gitroom/react/form/input';
import { FormProvider, useForm } from 'react-hook-form';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';

type Subscription = {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  eventTypes: string[];
  secretVersions: Array<{ fingerprint: string }>;
};

export const Webhooks: FC = () => {
  const request = useFetch();
  const toast = useToaster();
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const load = useCallback(
    async () => (await request('/webhooks')).json(),
    [request]
  );
  const { data = [], mutate } = useSWR<Subscription[]>('secure-webhooks', load);

  const remove = async (subscription: Subscription) => {
    if (!(await deleteDialog(`Delete ${subscription.name}?`))) return;
    const response = await request(`/webhooks/${subscription.id}`, {
      method: 'DELETE',
    });
    toast.show(
      response.ok ? 'Webhook deleted' : 'Webhook could not be deleted',
      response.ok ? 'success' : 'warning'
    );
    await mutate();
  };

  const toggle = async (subscription: Subscription) => {
    const response = await request(`/webhooks/${subscription.id}/enabled`, {
      method: 'POST',
      body: JSON.stringify({ enabled: !subscription.enabled }),
    });
    const result = await response.json().catch(() => ({}));
    toast.show(
      response.ok
        ? `Webhook ${result.enabled ? 'enabled' : 'disabled'}`
        : 'Webhook delivery is disabled by the administrator',
      response.ok ? 'success' : 'warning'
    );
    await mutate();
  };

  return (
    <section className="flex flex-col gap-4" aria-labelledby="webhook-heading">
      <div>
        <h3 id="webhook-heading" className="text-[20px]">
          Webhooks
        </h3>
        <p className="mt-1 text-customColor18">
          Create signed Codestra event subscriptions. Secrets are shown once and
          delivery is disabled until approved.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-fifth bg-sixth p-4">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-fifth">
              <th className="p-3">Name</th>
              <th className="p-3">Destination</th>
              <th className="p-3">Status</th>
              <th className="p-3">Secret fingerprint</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((subscription) => (
              <tr key={subscription.id} className="border-b border-fifth/60">
                <td className="p-3">{subscription.name}</td>
                <td
                  className="max-w-[260px] truncate p-3"
                  title={subscription.url}
                >
                  {subscription.url}
                </td>
                <td className="p-3">
                  {subscription.enabled ? 'Enabled' : 'Disabled'}
                </td>
                <td className="p-3 font-mono text-xs">
                  {subscription.secretVersions[0]?.fingerprint || 'Unavailable'}
                </td>
                <td className="flex flex-wrap gap-2 p-3">
                  <Button
                    onClick={() => {
                      setEditing(subscription);
                      setShowForm(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button secondary onClick={() => toggle(subscription)}>
                    {subscription.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    secondary
                    onClick={() =>
                      setHistoryId(
                        historyId === subscription.id ? null : subscription.id
                      )
                    }
                  >
                    Deliveries
                  </Button>
                  <Button secondary onClick={() => remove(subscription)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && (
          <p className="p-6 text-center text-customColor18">
            No webhook subscriptions.
          </p>
        )}
      </div>
      {historyId && <DeliveryHistory subscriptionId={historyId} />}
      <div>
        <Button
          onClick={() => {
            setEditing(null);
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Close' : 'Add webhook'}
        </Button>
      </div>
      {showForm && (
        <WebhookForm
          subscription={editing}
          onSaved={async () => {
            setShowForm(false);
            setEditing(null);
            await mutate();
          }}
        />
      )}
    </section>
  );
};

const WebhookForm: FC<{
  subscription: Subscription | null;
  onSaved: () => void;
}> = ({ subscription, onSaved }) => {
  const request = useFetch();
  const toast = useToaster();
  const [oneTimeSecret, setOneTimeSecret] = useState('');
  const form = useForm({
    defaultValues: {
      name: subscription?.name || '',
      url: subscription?.url || '',
      eventTypes:
        subscription?.eventTypes.join(', ') || 'post.published, post.failed',
    },
  });
  const submit = async (values: {
    name: string;
    url: string;
    eventTypes: string;
  }) => {
    const response = await request(
      subscription ? `/webhooks/${subscription.id}` : '/webhooks',
      {
        method: subscription ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: values.name,
          url: values.url,
          eventTypes: values.eventTypes
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      return toast.show('Webhook could not be saved', 'warning');
    if (result.secret) {
      setOneTimeSecret(result.secret);
      toast.show(
        'Copy the signing secret now. It will not be shown again.',
        'success'
      );
      return;
    }
    toast.show('Webhook updated', 'success');
    onSaved();
  };
  const sendTest = async () => {
    if (!subscription)
      return toast.show('Save the webhook before testing', 'warning');
    const response = await request(`/webhooks/${subscription.id}/test`, {
      method: 'POST',
      body: '{}',
    });
    const result = await response.json().catch(() => ({}));
    toast.show(
      response.ok && result.accepted !== false
        ? 'Test webhook queued'
        : 'Test delivery is disabled or unavailable',
      response.ok && result.accepted !== false ? 'success' : 'warning'
    );
  };
  return (
    <FormProvider {...form}>
      <form
        className="max-w-2xl space-y-4 rounded-xl border border-fifth bg-sixth p-6"
        onSubmit={form.handleSubmit(submit)}
      >
        <Input label="Name" {...form.register('name', { required: true })} />
        <Input
          label="HTTPS destination"
          {...form.register('url', { required: true })}
        />
        <Input
          label="Event types (comma separated)"
          {...form.register('eventTypes', { required: true })}
        />
        {oneTimeSecret && (
          <div
            role="status"
            className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4"
          >
            <strong>One-time signing secret</strong>
            <code className="mt-2 block break-all select-all">
              {oneTimeSecret}
            </code>
            <p className="mt-2 text-sm">
              Store it in your receiver’s protected secret manager, then close
              this form.
            </p>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" secondary onClick={sendTest}>
            Send test webhook
          </Button>
          {oneTimeSecret && (
            <Button type="button" secondary onClick={onSaved}>
              I stored the secret
            </Button>
          )}
        </div>
      </form>
    </FormProvider>
  );
};

const DeliveryHistory: FC<{ subscriptionId: string }> = ({
  subscriptionId,
}) => {
  const request = useFetch();
  const load = useCallback(
    async () =>
      (await request(`/webhooks/${subscriptionId}/deliveries`)).json(),
    [request, subscriptionId]
  );
  const { data = [] } = useSWR(`webhook-history-${subscriptionId}`, load);
  return (
    <div className="rounded-xl border border-fifth bg-sixth p-4">
      <h4 className="mb-3 font-semibold">Delivery attempts</h4>
      {!data.length ? (
        <p className="text-customColor18">No attempts recorded.</p>
      ) : (
        <ul className="space-y-2">
          {data.map((attempt: any) => (
            <li
              key={attempt.id}
              className="grid grid-cols-2 gap-2 rounded-lg bg-black/10 p-3 md:grid-cols-5"
            >
              <span>{attempt.state}</span>
              <span>Attempt {attempt.attempt}</span>
              <span>HTTP {attempt.responseCode || '—'}</span>
              <span>{attempt.errorCode || 'No error'}</span>
              <time>{new Date(attempt.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
