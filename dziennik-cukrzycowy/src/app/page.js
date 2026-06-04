'use client';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { useState, useEffect } from 'react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [carbs, setCarbs] = useState('');
  const [insulin, setInsulin] = useState('');
  const [mealType, setMealType] = useState('Obiad');
  const [history, setHistory] = useState([]);

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
    
    // Zabezpieczenie przed przecinkami zamiast kropek
    const safeCarbs = carbs.replace(',', '.');
    const safeInsulin = insulin.replace(',', '.');

    try {
      await addDoc(collection(db, "meals"), {
        carbs: parseFloat(safeCarbs),
        insulin: parseFloat(safeInsulin),
        mealType,
        timestamp: new Date().toISOString(),
        userEmail: user.email 
      });
      
      setCarbs('');
      setInsulin('');
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

  // --- LOGIKA PODSUMOWANIA DNIA ---
  const dzisiejszaData = new Date();
  
  // Filtrujemy tylko wpisy z dzisiaj
  const todaysMeals = history.filter((item) => {
    const itemDate = new Date(item.timestamp);
    return itemDate.getDate() === dzisiejszaData.getDate() &&
           itemDate.getMonth() === dzisiejszaData.getMonth() &&
           itemDate.getFullYear() === dzisiejszaData.getFullYear();
  });

  // Sumujemy wartości
  const totalCarbs = todaysMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalInsulin = todaysMeals.reduce((sum, item) => sum + (Number(item.insulin) || 0), 0);
  // --------------------------------

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

      <div className="space-y-4 mb-8">
        <h3 className="text-xl font-bold text-gray-900">Dzisiejsze podsumowanie</h3>
        
        {/* NOWOŚĆ: Karta Podsumowania */}
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

        {todaysMeals.length === 0 ? (
          <p className="text-gray-600 italic bg-white p-4 rounded-xl border border-gray-200 text-center">Dodaj wpis, aby zobaczyć podsumowanie.</p>
        ) : (
          <div className="space-y-2 mt-4">
            {/* Zmieniliśmy history.map na todaysMeals.map */}
            {todaysMeals.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div>
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    {formatTime(item.timestamp)} - {item.mealType}
                  </span>
                  <div className="text-lg font-bold text-gray-900 mt-0.5">
                    Węglowodany: <span className="text-blue-700">{item.carbs}g</span>
                  </div>
                </div>
                
                <div className="flex flex-col items-end justify-between">
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