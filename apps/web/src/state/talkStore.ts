import { createChatStore, initialChatData } from './chatStore';

export type { ChatEntry, ChatEntryState } from './chatStore';
export { historyFor } from './chatStore';

export const initialTalkData = initialChatData;

/** "Talk to me": one free-form conversation about the queue. */
export const useTalkStore = createChatStore({ path: '/api/ai/talk' });
