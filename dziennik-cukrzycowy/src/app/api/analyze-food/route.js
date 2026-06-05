import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { imageBase64 } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: "Brak zdjęcia w żądaniu" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Serwer nie został skonfigurowany (brak klucza API)" }, { status: 500 });
    }

    // Konstruujemy zapytanie do darmowego modelu Gemini 1.5 Flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Przeanalizuj to zdjęcie posiłku dla osoby z cukrzycą. Rozpoznaj co jest na talerzu i oszacuj łączną zawartość węglowodanów w gramach dla całego widocznego posiłku. Odpowiedz BEZWZGLĘDNIE wyłącznie w formacie JSON (bez żadnego formatowania markdown, bez 
http://googleusercontent.com/immersive_entry_chip/0

Po zakończeniu budowania przez Vercel, odśwież aplikację w telefonie. Przyciski skanera i aparatu ułożyły się w równe, czytelne kafelki. Kliknij zielony kafelek, zrób zdjęcie dowolnego posiłku i zobacz, jak sztuczna inteligencja bezbłędnie rozpisze Twój talerz!