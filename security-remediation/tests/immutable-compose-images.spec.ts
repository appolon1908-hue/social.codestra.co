import { readFileSync } from 'node:fs';

describe('production Compose image identity', () => {
  const compose = readFileSync('docker-compose.yaml', 'utf8');
  const imageReferences = compose
    .split('\n')
    .map((line) => line.match(/^\s*image:\s+(.+)\s*$/)?.[1].trim())
    .filter((value): value is string => Boolean(value));

  it('pins every literal production image to a SHA-256 manifest', () => {
    for (const image of imageReferences.filter(
      (value) => !value.startsWith('${')
    )) {
      expect(image).toMatch(/@sha256:[a-f0-9]{64}$/i);
    }
  });

  it('keeps application and optional debug images explicit deployment inputs', () => {
    expect(imageReferences).toContain(
      '${CODESTRA_SOCIAL_IMAGE:?set CODESTRA_SOCIAL_IMAGE to an immutable digest}'
    );
    expect(imageReferences).toContain(
      '${SPOTLIGHT_IMAGE:?set SPOTLIGHT_IMAGE to an immutable digest for debug}'
    );
  });

  it('contains seven pinned infrastructure images and no latest tag', () => {
    expect(
      imageReferences.filter((value) => value.includes('@sha256:'))
    ).toHaveLength(7);
    expect(compose).not.toMatch(/^\s*image:\s+\S+:latest(?:\s|$)/im);
  });
});
