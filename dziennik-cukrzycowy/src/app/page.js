'use client';
import { collection, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null); // Stan przechowujący info o użytkowniku
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [carbs, setCarbs] = useState('');
  const [insulin, setInsulin] = useState('');
  const [mealType, setMealType] = useState('Obiad');
  const [history, setHistory] = useState([]);

  const mealOptions = ['Śniadanie', 'II Śniadanie', 'Obiad', 'Kolacja', 'Przekąska'];

  /// Nasłuchiwanie na zmiany stanu logowania
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Pobieranie danych tylko wtedy, gdy użytkownik jest zalogowany
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "meals"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mealsArray = [];
      querySnapshot.forEach((doc) => {
        mealsArray.push({ id: doc.id, ...doc.data() });
      });
      setHistory(mealsArray);
    });

    return () => unsubscribe();
  }, [user]);

  // Funkcje logowania i wylogowania
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Błąd logowania:", error);
      alert(`Błąd logowania: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Błąd wylogowania:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return; // Zabezpieczenie przed zapisem bez logowania
    
    try {
      await addDoc(collection(db, "meals"), {
        carbs: parseFloat(carbs),
        insulin: parseFloat(insulin),
        mealType,
        timestamp: new Date().toISOString(),
        userEmail: user.email // Zapisujemy, kto dodał wpis
      });
      
      setCarbs('');
      setInsulin('');
    } catch (error) {
      console.error("Błąd Firebase:", error);
      alert(`Błąd zapisu: ${error.message}`);
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  // Ekran ładowania
  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">Ładowanie...</div>;
  }

  // Ekran logowania (jeśli brak usera)
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 text-center max-w-sm w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Dziennik Cukrzycowy</h1>
          <p className="text-gray-600 mb-8">Zaloguj się, aby uzyskać dostęp do dziennika.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-all active:scale-95"
          >
            Zaloguj się przez Google
          </button>
        </div>
      </div>
    );
  }

  // Główny widok aplikacji (jeśli zalogowany)
  return (
    <div className="max-w-md mx-auto p-4 bg-gray-100 min-h-screen text-gray-900">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dziennik</h2>
        <button onClick={handleLogout} className="text-sm font-bold text-gray-500 hover:text-red-600 transition-colors">
          Wyloguj
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl shadow-md border border-gray-200 mb-8">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Pora dnia</label>
          <div className="flex flex-wrap gap-2">
            {mealOptions.map((meal) => (
              <button
                key={meal}
                type="button"
                onClick={() => setMealType(meal)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  mealType === meal ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {meal}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Węglowodany (g)</label>
          <input
            type="text"
            inputMode="decimal"
            value={carbs}
            onChange={(e) => setCarbs(e.target.value)}
            placeholder="np. 45"
            className="w-full text-3xl font-bold p-4 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Insulina (jednostki)</label>
          <input
            type="text"
            inputMode="decimal"
            value={insulin}
            onChange={(e) => setInsulin(e.target.value)}
            placeholder="np. 3.5"
            className="w-full text-3xl font-bold p-4 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500 outline-none"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-all active:scale-95"
        >
          Zapisz w dzienniku
        </button>
      </form>

      <div className="space-y-4">
        <h3 className="text-xl font-bold text-gray-900">Dzisiejsze wpisy</h3>
        {history.length === 0 ? (
          <p className="text-gray-600 italic bg-white p-4 rounded-xl border border-gray-200 text-center">Brak wpisów.</p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {formatTime(item.timestamp)} - {item.mealType}
                  </span>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    Węglowodany: <span className="text-blue-700">{item.carbs}g</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-gray-500 block">Insulina</span>
                  <span className="text-xl font-black text-emerald-600">{item.insulin} j.</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}