import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

describe('Codestra Social recovery authority', () => {
  it('passes the paired database and uploads recovery suite', () => {
    const root = resolve(__dirname, '../..');
    const output = execFileSync(
      'python3',
      [
        '-m',
        'unittest',
        'discover',
        '-s',
        'tests/recovery',
        '-p',
        'test_*.py',
        '-v',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    expect(output).toContain('');
  });
});
