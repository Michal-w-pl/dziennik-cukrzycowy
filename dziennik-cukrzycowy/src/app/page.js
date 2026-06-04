'use client';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Formularz
  const [carbs, setCarbs] = useState('');
  const [insulin, setInsulin] = useState('');
  const [sugar, setSugar] = useState(''); // NOWOŚĆ: Stan dla glikemii
  const [mealType, setMealType] = useState('Obiad');
  
  // Historia i Filtrowanie
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // NOWOŚĆ: Wybrana data (RRRR-MM-DD)

  const mealOptions = ['Śniadanie', 'II Śniadanie', 'Obiad', 'Kolacja', 'Przekąska'];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "meals"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mealsArray = [];
      querySnapshot.forEach((document) => {
        mealsArray.push({ id: document.id, ...document.data() });
      });
      setHistory(mealsArray);
    });

    return () => unsubscribe();
  }, [user]);

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
    if (!user) return; 
    
    const safeCarbs = carbs.replace(',', '.');
    const safeInsulin = insulin.replace(',', '.');
    const safeSugar = sugar.replace(',', '.'); // NOWOŚĆ

    try {
      await addDoc(collection(db, "meals"), {
        carbs: parseFloat(safeCarbs),
        insulin: parseFloat(safeInsulin),
        sugar: safeSugar ? parseFloat(safeSugar) : null, // Zapisujemy cukier, jeśli podano
        mealType,
        timestamp: new Date().toISOString(),
        userEmail: user.email 
      });
      
      setCarbs('');
      setInsulin('');
      setSugar(''); // Reset pola cukru
    } catch (error) {
      console.error("Błąd Firebase:", error);
      alert(`Błąd zapisu: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = window.confirm("Czy na pewno chcesz usunąć ten wpis?");
    if (isConfirmed) {
      try {
        await deleteDoc(doc(db, "meals", id));
      } catch (error) {
        console.error("Błąd usuwania:", error);
        alert(`Błąd podczas usuwania: ${error.message}`);
      }
    }
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  };

  // --- LOGIKA FILTROWANIA I SUMOWANIA DLA WYBRANEGO DNIA ---
  const filteredMeals = history.filter((item) => {
    const itemDateStr = new Date(item.timestamp).toISOString().split('T')[0];
    return itemDateStr === selectedDate;
  });

  const totalCarbs = filteredMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalInsulin = filteredMeals.reduce((sum, item) => sum + (Number(item.insulin) || 0), 0);
  // --------------------------------------------------------

  if (isAuthChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">Ładowanie...</div>;
  }

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

        {/* NOWOŚĆ: Pole Glikemii */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Cukier / Glikemia (mg/dl) <span className="text-xs font-normal text-gray-400">(opcjonalnie)</span></label>
          <input
            type="text"
            inputMode="numeric"
            value={sugar}
            onChange={(e) => setSugar(e.target.value)}
            placeholder="np. 124"
            className="w-full text-2xl font-bold p-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Węglowodany (g)</label>
            <input
              type="text"
              inputMode="decimal"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              placeholder="np. 45"
              className="w-full text-2xl font-bold p-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Insulina (j.)</label>
            <input
              type="text"
              inputMode="decimal"
              value={insulin}
              onChange={(e) => setInsulin(e.target.value)}
              placeholder="np. 3.5"
              className="w-full text-2xl font-bold p-3 bg-gray-50 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 outline-none"
              required
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-md transition-all active:scale-95"
        >
          Zapisz w dzienniku
        </button>
      </form>

      {/* NOWOŚĆ: Wybór daty do przeglądania historii */}
      <div className="mb-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
        <label className="text-sm font-bold text-gray-700">Przeglądaj dzień:</label>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm font-bold rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-4 mb-8">
        <h3 className="text-xl font-bold text-gray-900">Podsumowanie wybranego dnia</h3>
        
        <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center shadow-sm">
          <div className="text-center flex-1">
            <span className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Suma Węgli</span>
            <span className="text-3xl font-black text-gray-900">
              {Number(totalCarbs.toFixed(1))}
              <span className="text-sm font-bold text-gray-500 ml-1">g</span>
            </span>
          </div>
          <div className="w-px h-12 bg-gray-300/50"></div>
          <div className="text-center flex-1">
            <span className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Suma Insuliny</span>
            <span className="text-3xl font-black text-emerald-600">
              {Number(totalInsulin.toFixed(1))}
              <span className="text-sm font-bold text-emerald-500/70 ml-1">j.</span>
            </span>
          </div>
        </div>

        {filteredMeals.length === 0 ? (
          <p className="text-gray-600 italic bg-white p-4 rounded-xl border border-gray-200 text-center">Brak wpisów dla wybranego dnia.</p>
        ) : (
          <div className="space-y-2 mt-4">
            {filteredMeals.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex-1">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {formatTime(item.timestamp)} - {item.mealType}
                  </span>
                  
                  {/* NOWOŚĆ: Wyświetlanie cukru, jeśli istnieje we wpisie */}
                  {item.sugar && (
                    <div className="mt-1">
                      <span className="inline-block bg-red-50 text-red-700 text-xs font-black px-2 py-0.5 rounded-md border border-red-100">
                        Cukier: {item.sugar} mg/dl
                      </span>
                    </div>
                  )}
                  
                  <div className="text-base font-bold text-gray-900 mt-1">
                    Węglowodany: <span className="text-blue-700">{item.carbs}g</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end justify-between ml-2">
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-500 block">Insulina</span>
                    <span className="text-xl font-black text-emerald-600">{item.insulin} j.</span>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="mt-2 text-xs font-bold text-red-500 hover:text-red-700 transition-colors p-1"
                  >
                    USUŃ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}