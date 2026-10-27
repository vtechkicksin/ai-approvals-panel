import { expect, openAction, test } from './fixtures';

test.describe('Teach me', () => {
  test('walks through the steps from the policy and answers a follow-up', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'text', pieces: ['Open it to check ', 'the content matches the title.'] });
    await openAction(panel, 'Teach me');

    await expect(panel.getByText('Step 1 of 5')).toBeVisible();
    await expect(panel.getByText('Open the item and check the title and location are correct.')).toBeVisible();
    await panel.getByRole('button', { name: /next/i }).click();
    await expect(panel.getByText('Step 2 of 5')).toBeVisible();

    await panel.getByRole('textbox', { name: 'Ask about this step' }).fill('Why open the file?');
    await panel.getByRole('textbox', { name: 'Ask about this step' }).press('Enter');
    await expect(panel.getByText('Open it to check the content matches the title.')).toBeVisible();

    const [call] = await gemini.calls();
    expect(JSON.stringify(call!.body.systemInstruction)).toContain('Step 2 of 5');
  });

  test('repeats the step with the policy text when the AI is unavailable', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'error', status: 429 });
    await openAction(panel, 'Teach me');

    await panel.getByRole('button', { name: 'Explain this step more simply' }).click();

    await expect(panel.getByText(/can.t answer follow-up questions right now/i)).toBeVisible();
    await expect(panel.getByText(/AI assistant is unavailable/)).toBeVisible();
  });

  test('finishes the guide', async ({ panel }) => {
    await openAction(panel, 'Teach me');
    for (let i = 0; i < 4; i++) await panel.getByRole('button', { name: /next/i }).click();
    await panel.getByRole('button', { name: 'Finish' }).click();

    await expect(panel.getByText("You're ready to review approvals.")).toBeVisible();
  });
});
