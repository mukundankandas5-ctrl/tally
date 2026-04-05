const Anthropic = require("@anthropic-ai/sdk");
const env = require("../config/env");
const AppError = require("../utils/appError");

let client = null;

function getClient() {
  if (!env.anthropicApiKey) {
    throw new AppError(
      "Anthropic API key is missing. Add ANTHROPIC_API_KEY to your .env file before using AI extraction.",
      500
    );
  }

  if (!client) {
    client = new Anthropic({
      apiKey: env.anthropicApiKey,
    });
  }

  return client;
}

function responseToText(response) {
  return (response.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function extractJsonString(text) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  throw new AppError("Claude returned a response that could not be parsed as JSON.", 502, {
    rawResponse: text,
  });
}

async function requestStructuredJson({ systemPrompt, contentBlocks, maxTokens = 4096 }) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    temperature: 0,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: contentBlocks,
      },
    ],
  });

  const rawText = responseToText(response);
  const jsonText = extractJsonString(rawText);

  try {
    return JSON.parse(jsonText);
  } catch (error) {
    throw new AppError("Claude returned invalid JSON.", 502, {
      rawResponse: rawText,
      parseError: error.message,
    });
  }
}

module.exports = {
  requestStructuredJson,
};
