import { test, expect } from '@playwright/test';
import path from 'node:path';

const axePath = path.resolve('node_modules/axe-core/axe.min.js');

for (const route of ['/auth/login', '/auth/forgot', '/auth/activate']) {
  test(`${route} renders without broken links or serious accessibility defects`, async ({
    page,
  }) => {
    const failures: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 500)
        failures.push(`${response.status()} ${response.url()}`);
    });
    await page.goto(route, { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toBeVisible();
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const result = await (window as any).axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] },
      });
      return result.violations
        .filter((violation: any) =>
          ['critical', 'serious'].includes(violation.impact)
        )
        .map((violation: any) => violation.id);
    });
    expect(failures).toEqual([]);
    expect(violations).toEqual([]);

    const sameOriginLinks = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) =>
        links
          .map((link) => (link as HTMLAnchorElement).getAttribute('href'))
          .filter(Boolean)
      );
    for (const href of [...new Set(sameOriginLinks)]) {
      const response = await page.request.get(href as string, {
        maxRedirects: 0,
      });
      expect(response.status(), `broken link ${href}`).toBeLessThan(500);
    }
  });
}
