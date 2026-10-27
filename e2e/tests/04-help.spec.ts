import { expect, openAction, test } from './fixtures';

test.describe('Help me', () => {
  test('answers from the policy and shows its sources', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'text', pieces: ['Reject it if the file ', 'is missing (section 4).'] });
    await openAction(panel, 'Help me');

    await panel.getByRole('button', { name: 'When should I reject an item?' }).click();

    const sources = panel.getByRole('list', { name: 'Sources from the policy' });
    await expect(sources).toContainText('4. When to reject');
    await expect(panel.getByText('Reject it if the file is missing (section 4).')).toBeVisible();
    const [call] = await gemini.calls();
    expect(JSON.stringify(call!.body)).toContain('Reject an item if the file is missing');
  });

  test('says when the policy does not cover a question, without calling the AI', async ({ panel, gemini }) => {
    await openAction(panel, 'Help me');

    await panel.getByRole('textbox', { name: 'Question' }).fill('What is the weather in Delhi today?');
    await panel.getByRole('button', { name: 'Ask', exact: true }).click();

    await expect(panel.getByText(/not covered by the approval policy/i)).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Talk to me' })).toBeVisible();
    expect(await gemini.calls()).toHaveLength(0);
  });

  test('shows the matching policy text when Gemini is down', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'error', status: 503 }, { kind: 'error', status: 503 });
    await openAction(panel, 'Help me');

    await panel.getByRole('button', { name: 'When should I reject an item?' }).click();

    await expect(panel.getByText(/AI assistant is unavailable/)).toBeVisible();
    // The policy text is the answer itself (it also appears in the collapsed source excerpt).
    await expect(panel.locator('.help-answer__text')).toContainText('Reject an item if the file is missing');
  });
});
