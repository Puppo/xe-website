import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('la pagina contatti è accessibile con o senza modulo', async ({
  page,
}) => {
  await page.goto('/contatti/');
  const form = page.locator('[data-contact-form]'),
    expectedVariant = process.env.CONTACT_FORM_VARIANT ?? 'auto';
  if (expectedVariant === 'form' || expectedVariant === 'fallback') {
    await expect(form).toHaveCount(expectedVariant === 'form' ? 1 : 0);
  }

  if ((await form.count()) > 0) {
    const name = page.locator('#name'),
      email = page.locator('#email'),
      message = page.locator('#message'),
      privacy = page.locator('#privacy');
    await expect(name).toHaveAccessibleName(/^Nome/);
    await expect(email).toHaveAccessibleName(/^Email/);
    await expect(message).toHaveAccessibleName(/^Messaggio/);
    await expect(privacy).toHaveAccessibleName(/^Ho letto/);
    for (const control of [name, email, message, privacy]) {
      await expect(control).toHaveAttribute('required', '');
    }
    await expect(message).toHaveAttribute('aria-describedby', 'message-help');
    await expect(page.locator('#message-help')).toContainText(
      'Indica il contesto',
    );
    const honeypot = form.locator('.honeypot');
    await expect(honeypot).toHaveAttribute('aria-hidden', 'true');
    await expect(honeypot.locator('input')).toHaveAttribute('tabindex', '-1');

    await name.focus();
    await page.keyboard.type('Mario Rossi');
    await page.keyboard.press('Tab');
    await expect(email).toBeFocused();
    await page.keyboard.type('mario.rossi@example.com');
    await page.keyboard.press('Tab');
    await expect(message).toBeFocused();
    await page.keyboard.type('Vorrei proporre una sessione.');
    await page.keyboard.press('Tab');
    await expect(privacy).toBeFocused();
    await page.keyboard.press('Space');
    await expect(privacy).toBeChecked();
    await page.keyboard.press('Tab');
    await expect(
      form.getByRole('link', { name: 'informativa sulla privacy' }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(
      form.getByRole('button', { name: 'Invia il messaggio' }),
    ).toBeFocused();
  } else {
    const fallback = page.getByRole('link', {
      name: 'Scrivi a staff@xedotnet.org',
    });
    await expect(fallback).toBeVisible();
    await expect(fallback).toHaveAttribute('href', 'mailto:staff@xedotnet.org');
  }

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
