import { expect, openAction, test } from './fixtures';

test.describe('Talk to me', () => {
  test('holds a multi-turn conversation with streamed replies', async ({ panel, gemini }) => {
    await gemini.reply(
      { kind: 'text', pieces: ['Start with ', 'the camera map.'] },
      { kind: 'text', pieces: ['Then the ', 'safety specs.'] },
    );
    await openAction(panel, 'Talk to me');
    const log = panel.getByRole('log', { name: 'Conversation' });
    const box = panel.getByRole('textbox', { name: 'Message' });

    await panel.getByRole('button', { name: /which of these needs my attention first/i }).click();
    await expect(log).toContainText('Start with the camera map.');

    await box.fill('And after that?');
    await box.press('Enter');
    await expect(log).toContainText('Then the safety specs.');

    const calls = await gemini.calls();
    expect(calls[1]!.body.contents).toHaveLength(3); // user, model, user
  });

  test('offers the other actions when the AI does not answer in time', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'silent' });
    await openAction(panel, 'Talk to me');

    await panel.getByRole('textbox', { name: 'Message' }).fill('Hello?');
    await panel.getByRole('textbox', { name: 'Message' }).press('Enter');

    const log = panel.getByRole('log', { name: 'Conversation' });
    await expect(log).toContainText(/can.t chat right now/i);
    await log.getByRole('button', { name: 'Help me' }).click();
    await expect(panel.getByRole('heading', { name: 'Help me' })).toBeVisible();
  });

  test('keeps a reply that was cut short, with a note', async ({ panel, gemini }) => {
    await gemini.reply({ kind: 'stall', pieces: ['Start with the'] });
    await openAction(panel, 'Talk to me');

    await panel.getByRole('textbox', { name: 'Message' }).fill('Which first?');
    await panel.getByRole('textbox', { name: 'Message' }).press('Enter');

    const log = panel.getByRole('log', { name: 'Conversation' });
    await expect(log).toContainText('Start with the');
    await expect(log).toContainText(/reply was cut short/i);
  });
});
