import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: "Brak zdjęcia w żądaniu" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Brak klucza API" }, { status: 500 });
    }

    // Tekst podzielony na kawałki za pomocą +, aby edytor kodu nie "złamał" linijki i nie zepsuł aplikacji
    const promptText = "Przeanalizuj to zdjęcie posiłku dla osoby z cukrzycą. " +
      "Rozpoznaj co jest na talerzu i oszacuj łączną zawartość węglowodanów w gramach " +
      "dla całego widocznego posiłku. Odpowiedz BEZWZGLĘDNIE wyłącznie w formacie JSON " +
      "(bez żadnego formatowania markdown), używając następujących kluczy: " +
      "'product_name' (krótki opis rozpoznanego posiłku po polsku) oraz 'carbs' " +
      "(szacowana liczba węglowodanów w gramach jako liczba, np. 45.5). Staraj się być precyzyjny.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    const data = await response.json();
    
    const aiTextResponse = data.candidates[0].content.parts[0].text;
    const foodAnalysis = JSON.parse(aiTextResponse);

    return NextResponse.json(foodAnalysis);

  } catch (error) {
    console.error("Błąd API Route:", error);
    return NextResponse.json({ error: "Błąd podczas przetwarzania obrazu przez AI" }, { status: 500 });
  }
}