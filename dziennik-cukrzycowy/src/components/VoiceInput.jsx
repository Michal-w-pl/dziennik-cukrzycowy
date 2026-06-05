"use client"; // Niezbędne w Next.js App Router przy korzystaniu z hooków i obiektu window

import { useState, useEffect, useRef } from "react";

export default function VoiceInput({ onIngredientsParsed }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Referencja do zachowania instancji rozpoznawania mowy między renderami
  const recognitionRef = useRef(null);

  useEffect(() => {
    // Inicjalizacja Web Speech API (z obsługą prefiksów dla różnych przeglądarek)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.warn("Twoja przeglądarka nie obsługuje Web Speech API.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "pl-PL"; // Język polski
    recognition.continuous = false; // Zatrzymuje nasłuch po zakończeniu zdania
    recognition.interimResults = false; // Interesuje nas tylko gotowy, pełny tekst

    recognition.onresult = async (event) => {
      // Pobranie przetłumaczonego tekstu z mowy
      const finalTranscript = event.results[0][0].transcript;
      setTranscript(finalTranscript);
      setIsListening(false);
      
      // Natychmiastowe wysłanie do Gemini NLP
      await processTextWithAI(finalTranscript);
    };

    recognition.onerror = (event) => {
      console.error("Błąd rozpoznawania mowy:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const processTextWithAI = async (text) => {
    setIsProcessing(true);
    try {
      // Strzał do naszego backendu z Gemini (Route Handler)
      const res = await fetch("/api/nlp-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        // Zwracamy obiekt JSON (np. { skladniki: [...] }) do komponentu nadrzędnego
        if (onIngredientsParsed) {
          onIngredientsParsed(data);
        }
      } else {
        console.error("Błąd po stronie backendu NLP.");
      }
    } catch (error) {
      console.error("Błąd sieci podczas łączenia z AI:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 my-4">
      <button
        type="button"
        onClick={toggleListening}
        disabled={isProcessing}
        className={`relative flex items-center justify-center p-4 rounded-full text-white shadow-lg transition-colors duration-300 ${
          isListening 
            ? "bg-red-500 hover:bg-red-600" 
            : "bg-blue-600 hover:bg-blue-700"
        } ${isProcessing ? "opacity-50 cursor-wait" : ""}`}
        aria-label="Wprowadzanie głosowe"
      >
        {/* Efekt "Radaru" z Tailwind CSS widoczny podczas nagrywania */}
        {isListening && (
          <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-75"></span>
        )}
        
        {/* Ikona Mikrofonu (SVG) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="w-7 h-7 relative z-10"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
          />
        </svg>
      </button>

      {/* Wizualny feedback tekstowy dla użytkownika */}
      <div className="h-6 text-sm text-center font-medium">
        {isListening && (
          <span className="text-red-500 animate-pulse">Nasłuchuję...</span>
        )}
        {isProcessing && (
          <span className="text-blue-500 animate-pulse">Sztuczna Inteligencja analizuje posiłek...</span>
        )}
        {transcript && !isListening && !isProcessing && (
          <span className="text-gray-600 italic">"{transcript}"</span>
        )}
      </div>
    </div>
  );
}