import { expect, setLanguage, test } from './fixtures';

test.describe('Replay Greeting and language', () => {
  test('uses the AI wording only when it keeps the real numbers', async ({ panel, gemini }) => {
    await gemini.reply(
      { kind: 'text', pieces: ['Hello! 4 approvals ', 'are waiting for you.'] },
      { kind: 'text', pieces: ['Hello! 9 approvals are waiting.'] },
    );
    const greeting = panel.getByRole('status', { name: 'Greeting' });
    await panel.getByText('Let AI word it').click();

    await panel.getByRole('button', { name: 'Replay Greeting' }).click();
    await expect(greeting).toHaveText('Hello! 4 approvals are waiting for you.');
    await expect(panel.getByText('Worded by AI')).toBeVisible();

    await panel.getByRole('button', { name: 'Replay Greeting' }).click();
    await expect(panel.getByText(/showing the standard greeting/i)).toBeVisible();
    await expect(greeting).toContainText('4 approvals are waiting (1 urgent, 1 high, 2 medium)');
  });

  test('switches the greeting and the AI language to Hindi', async ({ page, panel, gemini }) => {
    await gemini.reply({ kind: 'text', pieces: ['ठीक है।'] });
    await setLanguage(page, 'hi');

    await expect(panel.getByRole('status', { name: 'Greeting' })).toContainText('4 अनुमोदन लंबित हैं');

    await panel.getByRole('button', { name: 'Talk to me', exact: true }).click();
    await panel.getByRole('textbox', { name: 'Message' }).fill('नमस्ते');
    await panel.getByRole('textbox', { name: 'Message' }).press('Enter');
    await expect(panel.getByText('ठीक है।')).toBeVisible();
    const [call] = await gemini.calls();
    expect(JSON.stringify(call!.body.systemInstruction)).toContain('Hindi');
  });
});
