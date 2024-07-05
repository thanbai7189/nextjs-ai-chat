//LANGCHAIN STREAMING
/**
 * In this example, only
 */

import { createStreamDataTransformer, StreamingTextResponse } from "ai";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts"; //help to translate user input and parameters into instructions for a language model.
import { HttpResponseOutputParser } from "langchain/output_parsers"; //converting raw HTTP responses into a more manageable and interpretable format
import { decode } from "punycode";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Extract the `messages` from the body of the request
    const { messages } = await req.json();

    /**
     * In a conversation, the latest message often dictates the context for the next
     * response. By focusing on the last message, you ensure that the response is relevant
     * and coherent within the flow of the conversation.
     */
    const message = messages.at(-1).content;

    /**
     * set this message as a prompt template, a template for which the next prompts should
     * base on
     */
    const prompt = PromptTemplate.fromTemplate("{message}");

    // Request the OpenAI API for the response based on the prompt
    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-3.5-turbo",
      temperature: 0.8, //response precision, higher = higher hallucination
    });

    /**
     * Chat models stream message chunks rather than bytes, output parser handles
     * serialization and encoding
     */

    const parser = new HttpResponseOutputParser();
    const chain = prompt.pipe(model).pipe(parser); //chaining the pipeline
    const stream = await chain.stream({ message });

    //observe each chunk being decoded in console
    // const decoder = new TextDecoder();
    // for await (const chunk of stream) {
    //   console.log(chunk?.toString());
    //   if (chunk) {
    //     console.log(decoder.decode(chunk));
    //   }
    // }

    // Respond with the stream
    return new StreamingTextResponse(
      stream.pipeThrough(createStreamDataTransformer())
    );
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status });
  }
}
