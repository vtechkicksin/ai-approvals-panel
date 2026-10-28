import type { Language, NoticeCode } from '@approvals/schemas';

type MessageKey = NoticeCode | 'answer_failed' | 'talk_fallback';

/** Operator-facing status lines, in each supported language. */
const MESSAGES: Record<Language, Record<MessageKey, string>> = {
  en: {
    ai_slow: 'The assistant is slow right now, so here is a rule-based answer.',
    ai_unavailable: 'The AI assistant is unavailable right now, so here is a rule-based answer.',
    cut_short: 'The reply was cut short. You can try again.',
    rate_limited: 'Too many requests. Please wait a moment and try again.',
    answer_failed: 'Something went wrong. Please try again.',
    talk_fallback:
      "I can't chat right now. Present me Summary, Help me and Teach me still work, with rule-based answers.",
  },
  hi: {
    ai_slow: 'सहायक अभी धीमा है, इसलिए यह नियम-आधारित उत्तर है।',
    ai_unavailable: 'AI सहायक अभी उपलब्ध नहीं है, इसलिए यह नियम-आधारित उत्तर है।',
    cut_short: 'उत्तर बीच में रुक गया। आप फिर से कोशिश कर सकते हैं।',
    rate_limited: 'बहुत ज़्यादा अनुरोध। कृपया थोड़ी देर रुककर फिर से कोशिश करें।',
    answer_failed: 'कुछ गलत हो गया। कृपया फिर से कोशिश करें।',
    talk_fallback:
      'मैं अभी बातचीत नहीं कर सकता। Present me Summary, Help me और Teach me अब भी नियम-आधारित उत्तरों के साथ काम करते हैं।',
  },
};

export function message(language: Language, key: MessageKey): string {
  return MESSAGES[language][key];
}
