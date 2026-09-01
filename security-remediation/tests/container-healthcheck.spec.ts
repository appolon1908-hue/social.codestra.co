import { readFileSync } from 'node:fs';

describe('social runtime container healthcheck', () => {
  const compose = readFileSync('docker-compose.yaml', 'utf8');
  const publicationActivity = readFileSync(
    'apps/orchestrator/src/activities/post.activity.ts',
    'utf8'
  );

  it('checks the existing private authenticated Temporal health probe', () => {
    expect(compose).toContain(
      "fetch('http://127.0.0.1:3002/health/status',{signal:AbortSignal.timeout(5000)})"
    );
    expect(compose).not.toContain('/api/monitor/live');
  });

  it('uses the same publishing kill-switch semantics as the write boundary', () => {
    expect(compose).toContain("PUBLISHING_KILL_SWITCH: 'true'");
    expect(compose).toContain("process.env.PUBLISHING_KILL_SWITCH==='false'");
    expect(publicationActivity).toContain(
      "process.env.PUBLISHING_KILL_SWITCH !== 'false'"
    );
  });

  it('bounds both the request and container healthcheck duration', () => {
    expect(compose).toContain('AbortSignal.timeout(5000)');
    expect(compose).toContain('timeout: 8s');
  });
});
