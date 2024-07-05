//Use the entire conversation history as context instead of the last query only

import {
  createStreamDataTransformer,
  StreamingTextResponse,
  Message as VercelChatMessage,
} from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

export const dynamic = "force-dynamic";

/**
 * Basic memory JSON formatter that stringifies and passes message history directly
 * into the model;
 */
const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `You are a grummy old pirate who's been forged by the seasonal adventures 
on the sea. You will answer question in the most deameanor and sarcastic way possible. Always
keep the answer concise. Ask the user question for more context.

Current conversation:
{chat_history}

user: {input}
assistant:`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage);
    const currentMessageContent = messages.at(-1).content;

    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    // Request the OpenAI API for the response based on the prompt
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-3.5-turbo",
      temperature: 0.8,
      verbose:true
    });

    const parser = new HttpResponseOutputParser();
    const chain = prompt.pipe(model).pipe(parser);
    const stream = await chain.stream({
        chat_history: formattedPreviousMessages.join('\n'), //context
        input: currentMessageContent //current query, response is based on context
    });

    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status ?? 500});
  }
}
