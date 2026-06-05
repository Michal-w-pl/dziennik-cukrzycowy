import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: "Brak zdjęcia w żądaniu" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Brak klucza API w konfiguracji serwera." }, { status: 500 });
    }

    const promptText = "Przeanalizuj to zdjęcie posiłku dla osoby z cukrzycą. " +
      "Rozpoznaj co jest na talerzu i oszacuj łączną zawartość węglowodanów w gramach " +
      "dla całego widocznego posiłku. Odpowiedz BEZWZGLĘDNIE wyłącznie w formacie JSON " +
      "(bez żadnego formatowania markdown), używając następujących kluczy: " +
      "'product_name' (krótki opis rozpoznanego posiłku po polsku) oraz 'carbs' " +
      "(szacowana liczba węglowodanów w gramach jako liczba, np. 45.5). Staraj się być precyzyjny.";

    let data;
    let success = false;
    let lastError = null;

    // NOWOŚĆ: Pętla próbująca wysłać zapytanie do 3 razy
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
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

      data = await response.json();

      // Jeśli serwer jest przeciążony (503 UNAVAILABLE), czekamy i próbujemy ponownie
      if (data.error && data.error.status === 'UNAVAILABLE') {
        lastError = data.error;
        console.warn(`Próba ${attempt} odrzucona przez Google. Czekam 1.5s...`);
        // Czekamy 1.5 sekundy przed kolejną próbą
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue; 
      }

      // Jeśli to inny, twardy błąd (np. zły klucz), przerywamy od razu
      if (data.error) {
        return NextResponse.json({ error: `Błąd Google Gemini: ${data.error.message}` }, { status: 500 });
      }

      // Udało się!
      success = true;
      break; 
    }

    // Jeśli po 3 próbach nadal jest tłok
    if (!success) {
      return NextResponse.json({ error: "Serwery AI są w tej chwili wyjątkowo przeciążone. Spróbuj ponownie za kilka sekund." }, { status: 503 });
    }

    if (!data.candidates || data.candidates.length === 0) {
      return NextResponse.json({ error: "Gemini nie zwróciło wyników. Spróbuj zrobić zdjęcie z innego kąta." }, { status: 500 });
    }

    const aiTextResponse = data.candidates[0].content.parts[0].text;
    const foodAnalysis = JSON.parse(aiTextResponse);

    return NextResponse.json(foodAnalysis);

  } catch (error) {
    console.error("Błąd API Route:", error);
    return NextResponse.json({ error: `Szczegóły błędu serwera: ${error.message}` }, { status: 500 });
  }
}