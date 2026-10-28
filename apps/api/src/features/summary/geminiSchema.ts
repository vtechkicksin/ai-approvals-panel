import { SchemaType, type ResponseSchema } from '@google/generative-ai';

/**
 * Asks Gemini for JSON in this exact shape and field order. The order matters:
 * the server streams and checks fields as they arrive. `propertyOrdering` is
 * supported by the Gemini API but not yet typed in the SDK, hence the cast.
 */
export const geminiSummarySchema = {
  type: SchemaType.OBJECT,
  properties: {
    headline: { type: SchemaType.STRING },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: { id: { type: SchemaType.STRING }, reason: { type: SchemaType.STRING } },
        required: ['id', 'reason'],
        propertyOrdering: ['id', 'reason'],
      },
    },
    spokenScript: { type: SchemaType.STRING },
  },
  required: ['headline', 'items', 'spokenScript'],
  propertyOrdering: ['headline', 'items', 'spokenScript'],
} as unknown as ResponseSchema;
