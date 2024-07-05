//APPLY RAG PATTERN

import {
  createStreamDataTransformer,
  StreamingTextResponse,
  Message as VercelChatMessage,
} from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { HttpResponseOutputParser } from "langchain/output_parsers";

import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";


const loader = new JSONLoader("src/data/qa.json");

export const dynamic = "force-dynamic";

/**
 * Basic memory JSON formatter that stringifies and passes message history directly
 * into the model;
 */
const formatMessage = (message: VercelChatMessage) => {
  return `${message.role}: ${message.content}`;
};

const TEMPLATE = `Answer the user's questions based only on the following context. If the
question is out-of-context, reply politely that you don't have the information available.:
===================================
Context: {context}
===================================
Current conversation: {chat_history}

user: {question}
assitant:`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const formattedPreviousMessages = messages.slice(0, -1).map(formatMessage); //format the messages history
    const currentMessageContent = messages.at(-1).content;

    const docs = await loader.load();
    const prompt = PromptTemplate.fromTemplate(TEMPLATE);

    // Request the OpenAI API for the response based on the prompt
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-3.5-turbo",
      temperature: 0,
      streaming: true,
      verbose: true,
    });

    const parser = new HttpResponseOutputParser();
    const chain = RunnableSequence.from([
        {
            question: (input) => input.question,
            chat_history: (input) => input.chat_history,
            context: () => formatDocumentsAsString(docs), //context
        },
        prompt, //prompt template
        model,
        parser
    ]);

    //convert the response into friendly text stream
    const stream = await chain.stream({
      chat_history: formattedPreviousMessages.join("\n"), //context
      question: currentMessageContent, //current query, response is based on context
    });

    //respond with stream
    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
