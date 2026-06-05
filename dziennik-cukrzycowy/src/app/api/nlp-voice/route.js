import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: "Brak tekstu do analizy" }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
      // ZMIANA: Nowy prompt wymuszający na AI obliczanie węglowodanów
      systemInstruction: `Jesteś dietetykiem i asystentem w aplikacji Dziennik Cukrzycowy. 
      Twoim zadaniem jest ekstrakcja informacji o posiłkach z potocznego tekstu mówionego przez użytkownika.
      Zwróć TYLKO I WYŁĄCZNIE poprawny obiekt JSON o następującej strukturze:
      {
        "skladniki": [
          {
            "nazwa": "Nazwa produktu/potrawy w mianowniku (np. pierogi z serem, jabłko)",
            "ilosc": Wartość liczbowa (np. 3, 1.5),
            "jednostka": "Jednostka miary (np. sztuka, szklanka, garść, gram, plaster)",
            "szacowane_weglowodany": Szacunkowa ilość węglowodanów w podanej porcji dla tego konkretnego składnika (jako liczba zmiennoprzecinkowa, np. 15.5)
          }
        ]
      }
      Musisz samodzielnie oszacować węglowodany na podstawie wiedzy o żywieniu. Np. 1 szklanka mleka to ok. 12g węglowodanów.
      Jeśli użytkownik podaje ułamki, zamień je na liczby. Zignoruj informacje niebędące jedzeniem.`,
    });

    const result = await model.generateContent(text);
    const response = await result.response;
    const parsedData = JSON.parse(response.text());

    return NextResponse.json(parsedData, { status: 200 });

  } catch (error) {
    console.error("Błąd przetwarzania NLP:", error);
    return NextResponse.json(
      { error: "Nie udało się przetworzyć tekstu." },
      { status: 500 }
    );
  }
}