import { resultSchema } from "$lib/spec";
import { GoogleGenAI } from "@google/genai";
// The client gets the API key from the environment variable `GEMINI_API_KEY`.

export async function geminiFuckingDoYourJob(apiKey: string, image: Blob) {
  const ai = new GoogleGenAI({
    apiKey,
  });

  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-lite-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: await toBase64(image), // TODO: base64
        },
      },
      // {
      //   text: "Please read the text in the score screenshot. It might sometime be in the japanase. Do not translate song name just report it as is.",
      // },
    ],
    config: {
      responseMimeType: "application/json",
      responseJsonSchema: resultSchema.toJSONSchema(),
    },
  });

  console.log(response.text);
  return response;
}

export function toBase64(blob: Blob) {
  const { promise, resolve } = Promise.withResolvers<string>();
  const reader = new FileReader();

  reader.readAsDataURL(blob);
  reader.onloadend = () => {
    const base64data = reader.result as string;
    resolve(base64data.split(",")[1]);
  };

  return promise;
}
