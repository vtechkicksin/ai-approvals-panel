import { expect, openAction, test } from './fixtures';

test.describe('Rate limit', () => {
  test('asks the operator to wait after too many AI requests in a minute', async ({ panel, gemini }) => {
    await openAction(panel, 'Help me');
    const box = panel.getByRole('textbox', { name: 'Question' });

    // The suite allows 6 AI requests per session per minute. Off-policy questions are answered
    // by rules (no Gemini call), but they still count towards the limit. (City names appear
    // nowhere in the policy, so none of these match a section.)
    const cities = ['Delhi', 'Mumbai', 'Pune', 'Jaipur', 'Bhopal', 'Lucknow'];
    for (const city of cities) {
      await box.fill(`What is the weather in ${city}?`);
      await panel.getByRole('button', { name: 'Ask', exact: true }).click();
      await expect(panel.getByText(/not covered by the approval policy/i)).toBeVisible();
    }

    await box.fill('What is the weather in Shimla?');
    await panel.getByRole('button', { name: 'Ask', exact: true }).click();

    await expect(panel.getByRole('alert')).toContainText(/please wait about \d+ seconds/i);
    expect(await gemini.calls()).toHaveLength(0);
  });
});
