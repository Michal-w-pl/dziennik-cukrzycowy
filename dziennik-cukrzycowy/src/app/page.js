'use client';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import { useState, useEffect } from 'react';
import { ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts';
import { useZxing } from "react-zxing"; // NOWOŚĆ: Import skanera

const getLocalISODate = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return new Date(Date.now() - tzoffset).toISOString().split('T')[0];
};

const getLocalTime = () => {
  return new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
};

// NOWOŚĆ: Wydzielony komponent do obsługi kamery
const BarcodeScanner = ({ onResult, onCancel }) => {
  const { ref } = useZxing({
    onDecodeResult(result) {
      onResult(result.getText());
    },
  });

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4">
      <p className="text-white font-bold mb-4 animate-pulse">Nakieruj aparat na kod kreskowy...</p>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden border-4 border-blue-500 shadow-2xl relative">
        <video ref={ref} className="w-full h-auto object-cover" />
        {/* Celownik */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-3/4 h-1/3 border-2 border-red-500/50 rounded-lg"></div>
        </div>
      </div>
      <button 
        onClick={onCancel}
        className="mt-8 bg-gray-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-gray-700 transition-colors"
      >
        Anuluj skanowanie
      </button>
    </div>
  );
};

export default function Home() {
  const [user, setUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('diary');

  const [entryDate, setEntryDate] = useState('');
  const [entryTime, setEntryTime] = useState('');

  const [carbs, setCarbs] = useState('');
  const [insulin, setInsulin] = useState('');
  const [sugar, setSugar] = useState('');
  const [mealType, setMealType] = useState('Obiad');
  
  // NOWOŚĆ: Stany dla Skanera i Przelicznika
  const [isScanning, setIsScanning] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [portionWeight, setPortionWeight] = useState('');
  
  const [history, setHistory] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');

  const mealOptions = ['Śniadanie', 'II Śniadanie', 'Obiad', 'Kolacja', 'Przekąska'];

  useEffect(() => {
    setEntryDate(getLocalISODate());
    setEntryTime(getLocalTime());
    setSelectedDate(getLocalISODate());
  }, []);

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
      querySnapshot.forEach((document) => mealsArray.push({ id: document.id, ...document.data() }));
      setHistory(mealsArray);
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert(`Błąd logowania: ${error.message}`); }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } 
    catch (error) { console.error("Błąd wylogowania:", error); }
  };

  // --- LOGIKA SKANERA I API OPEN FOOD FACTS ---
  const handleScanResult = async (barcode) => {
    setIsScanning(false); // Zamykamy kamerę
    
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      
      if (data.status === 1) {
        const productName = data.product.product_name || 'Nieznany produkt';
        const carbs100 = data.product.nutriments.carbohydrates_100g;
        
        if (carbs100 !== undefined) {
          // Produkt znaleziony i ma dane o węglach - otwieramy kalkulator porcji
          setScannedProduct({ name: productName, carbsPer100: carbs100 });
        } else {
          alert(`Znaleziono "${productName}", ale brakuje danych o węglowodanach w bazie.`);
        }
      } else {
        alert('Nie znaleziono tego produktu w darmowej bazie Open Food Facts.');
      }
    } catch (error) {
      alert('Błąd połączenia z bazą Open Food Facts.');
    }
  };

  const applyPortionCalculation = () => {
    const weight = parseFloat(portionWeight.replace(',', '.'));
    if (!weight || weight <= 0) return;
    
    // Przeliczamy: (węgle_w_100g * podana_waga) / 100
    const calculatedCarbs = (scannedProduct.carbsPer100 * weight) / 100;
    
    setCarbs(calculatedCarbs.toFixed(1)); // Wrzucamy gotowy wynik do głównego formularza
    setScannedProduct(null); // Zamykamy kalkulator
    setPortionWeight('');
  };
  // ---------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return; 
    
    const safeCarbs = carbs.replace(',', '.');
    const safeInsulin = insulin.replace(',', '.');
    const safeSugar = sugar.replace(',', '.');
    const combinedDateTime = new Date(`${entryDate}T${entryTime}`);

    try {
      await addDoc(collection(db, "meals"), {
        carbs: parseFloat(safeCarbs),
        insulin: parseFloat(safeInsulin),
        sugar: safeSugar ? parseFloat(safeSugar) : null,
        mealType,
        timestamp: combinedDateTime.toISOString(),
        userEmail: user.email 
      });
      setCarbs(''); setInsulin(''); setSugar('');
      setEntryDate(getLocalISODate()); setEntryTime(getLocalTime());
    } catch (error) {
      alert(`Błąd zapisu: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Czy na pewno chcesz usunąć ten wpis?")) {
      try { await deleteDoc(doc(db, "meals", id)); } 
      catch (error) { alert(`Błąd podczas usuwania: ${error.message}`); }
    }
  };

  const formatTime = (isoString) => new Date(isoString).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  const formatDateLabel = (isoString) => new Date(isoString).toLocaleDateString('pl-PL', { month: 'numeric', day: 'numeric' });

  const filteredMeals = history.filter((item) => {
    if(!selectedDate) return false;
    return new Date(item.timestamp).toISOString().split('T')[0] === selectedDate;
  });

  const totalCarbs = filteredMeals.reduce((sum, item) => sum + (Number(item.carbs) || 0), 0);
  const totalInsulin = filteredMeals.reduce((sum, item) => sum + (Number(item.insulin) || 0), 0);

  const chartData = history
    .slice(0, 20)
    .map(item => ({
      name: `${formatDateLabel(item.timestamp)} ${formatTime(item.timestamp)}`,
      'Cukier': item.sugar || null,
      'Węglowodany': Number(item.carbs) || 0,
      'Insulina': Number(item.insulin) || 0,
    }))
    .reverse();

  const dailySummaryObj = {};
  history.forEach(item => {
    const dayKey = new Date(item.timestamp).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' });
    if (!dailySummaryObj[dayKey]) dailySummaryObj[dayKey] = { date: dayKey, carbs: 0, insulin: 0, sugarSum: 0, sugarCount: 0 };
    dailySummaryObj[dayKey].carbs += Number(item.carbs) || 0;
    dailySummaryObj[dayKey].insulin += Number(item.insulin) || 0;
    if (item.sugar) { dailySummaryObj[dayKey].sugarSum += item.sugar; dailySummaryObj[dayKey].sugarCount += 1; }
  });

  const dailySummaryArray = Object.values(dailySummaryObj).map(day => ({
    ...day, avgSugar: day.sugarCount > 0 ? Math.round(day.sugarSum / day.sugarCount) : '—'
  })).slice(0, 14);

  if (isAuthChecking || !entryDate) return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-600">Ładowanie...</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-gray-200 text-center max-w-sm w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Dziennik Cukrzycowy</h1>
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg py-4 rounded-xl shadow-md active:scale-95">Zaloguj się przez Google</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 bg-gray-100 min-h-screen text-gray-900 pb-12">
      {/* Renderowanie podglądu z kamery na pełnym ekranie (gdy aktywny) */}
      {isScanning && <BarcodeScanner onResult={handleScanResult} onCancel={() => setIsScanning(false)} />}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">CukierDziennik</h2>
        <button onClick={handleLogout} className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors">Wyloguj</button>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl mb-6 shadow-inner">
        <button onClick={() => setActiveTab('diary')} className={`flex-1 text-center font-bold py-2.5 text-sm rounded-lg transition-all ${activeTab === 'diary' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Dziennik</button>
        <button onClick={() => setActiveTab('reports')} className={`flex-1 text-center font-bold py-2.5 text-sm rounded-lg transition-all ${activeTab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Raporty i Wykres</button>
      </div>

      {activeTab === 'diary' && (
        <>
          <form onSubmit={handleSubmit} className="space-y-5 bg-white p-5 rounded-2xl shadow-md border border-gray-200 mb-6 relative">
            
            {/* NOWOŚĆ: Półprzezroczysta nakładka z wynikiem skanowania */}
            {scannedProduct && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 p-5 flex flex-col justify-center items-center rounded-2xl border-2 border-blue-500 text-center animate-fadeIn">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Znaleziono produkt</span>
                <h3 className="text-lg font-black text-gray-900 mb-2 leading-tight">{scannedProduct.name}</h3>
                <p className="text-sm font-medium text-gray-600 mb-6">Węglowodany: <span className="font-bold text-blue-600">{scannedProduct.carbsPer100}g</span> w 100g</p>
                
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Ile gramów zjadasz?</label>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  value={portionWeight} 
                  onChange={(e) => setPortionWeight(e.target.value)} 
                  placeholder="np. 150" 
                  className="w-3/4 text-center text-3xl font-black p-3 bg-gray-100 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 mb-6 outline-none" 
                  autoFocus
                />
                
                <div className="flex gap-2 w-full">
                  <button type="button" onClick={() => setScannedProduct(null)} className="flex-1 bg-gray-200 text-gray-700 font-bold py-3 rounded-xl">Anuluj</button>
                  <button type="button" onClick={applyPortionCalculation} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl shadow-md">Przelicz</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-gray-100">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Data wpisu</label>
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full text-sm font-bold p-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 outline-none" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Godzina</label>
                <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="w-full text-sm font-bold p-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 outline-none" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Pora dnia</label>
              <div className="flex flex-wrap gap-1.5">
                {mealOptions.map((meal) => (
                  <button key={meal} type="button" onClick={() => setMealType(meal)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${mealType === meal ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{meal}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Cukier / Glikemia (mg/dl)</label>
              <input type="text" inputMode="numeric" value={sugar} onChange={(e) => setSugar(e.target.value)} placeholder="np. 124 (opcjonalnie)" className="w-full text-xl font-bold p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 outline-none transition-all" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Węglowodany</label>
                  {/* NOWOŚĆ: Mały przycisk skanera nad polem węglowodanów */}
                  <button type="button" onClick={() => setIsScanning(true)} className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-1 rounded-md active:bg-blue-200 transition-colors flex items-center gap-1">
                    📷 SKANUJ KOD
                  </button>
                </div>
                <input type="text" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} placeholder="np. 45" className="w-full text-xl font-bold p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 outline-none transition-all" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Insulina (j.)</label>
                <input type="text" inputMode="decimal" value={insulin} onChange={(e) => setInsulin(e.target.value)} placeholder="np. 3.5" className="w-full text-xl font-bold p-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-gray-900 outline-none transition-all" required />
              </div>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-base py-3.5 rounded-xl shadow-md transition-all active:scale-95 mt-2">
              Zapisz wpis
            </button>
          </form>

          {/* ... reszta wyświetlania Dziennika pozostaje bez zmian ... */}
          <div className="mb-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Przeglądaj dzień:</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl p-2 outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="space-y-3">
            <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 rounded-2xl border border-blue-100 flex justify-between items-center shadow-sm">
              <div className="text-center flex-1">
                <span className="block text-xs font-bold text-blue-500 uppercase tracking-wider mb-0.5">Suma Węgli</span>
                <span className="text-2xl font-black text-gray-900">{Number(totalCarbs.toFixed(1))}<span className="text-xs font-bold text-gray-400 ml-0.5">g</span></span>
              </div>
              <div className="w-px h-10 bg-gray-300/60"></div>
              <div className="text-center flex-1">
                <span className="block text-xs font-bold text-emerald-600 uppercase tracking-wider mb-0.5">Suma Insuliny</span>
                <span className="text-2xl font-black text-emerald-600">{Number(totalInsulin.toFixed(1))}<span className="text-xs font-bold text-emerald-500/70 ml-0.5">j.</span></span>
              </div>
            </div>

            {filteredMeals.length === 0 ? (
              <p className="text-gray-500 italic bg-white p-4 rounded-xl border border-gray-200 text-center text-sm">Brak wpisów dla tego dnia.</p>
            ) : (
              <div className="space-y-2">
                {filteredMeals.map((item) => (
                  <div key={item.id} className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex-1">
                      <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">{formatTime(item.timestamp)} - {item.mealType}</span>
                      {item.sugar && <div className="mt-0.5"><span className="inline-block bg-red-50 text-red-600 text-xs font-black px-2 py-0.5 rounded-md border border-red-100">Cukier: {item.sugar} mg/dl</span></div>}
                      <div className="text-base font-bold text-gray-900 mt-0.5">Węglowodany: <span className="text-blue-600">{item.carbs}g</span></div>
                    </div>
                    <div className="flex flex-col items-end justify-between ml-2">
                      <div className="text-right">
                        <span className="text-xs font-bold text-gray-400 block">Insulina</span>
                        <span className="text-lg font-black text-emerald-600">{item.insulin} j.</span>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="mt-1.5 text-xs font-bold text-red-400 hover:text-red-600 p-1">USUŃ</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ... Sekcja Raportów ... */}
      {activeTab === 'reports' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-md">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Wykres Zależności</h3>
            {chartData.length === 0 ? (
              <p className="text-gray-500 italic text-center py-8 text-sm">Brak danych do wyświetlenia wykresu.</p>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#10b981' }} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <ReferenceLine yAxisId="left" y={70} stroke="#f59e0b" strokeDasharray="3 3" />
                    <ReferenceLine yAxisId="left" y={180} stroke="#ef4444" strokeDasharray="3 3" />
                    <Bar yAxisId="left" dataKey="Węglowodany" fill="#3b82f6" barSize={12} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="right" type="monotone" dataKey="Insulina" stroke="#10b981" strokeWidth={3} dot={{ r: 3, fill: '#10b981' }} />
                    <Line yAxisId="left" type="monotone" dataKey="Cukier" stroke="#ef4444" strokeWidth={3} connectNulls dot={{ r: 4, fill: '#ef4444' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Zestawienie ostatnich 14 dni</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-500 font-bold uppercase border-b border-gray-200">
                    <th className="p-3">Data</th>
                    <th className="p-3 text-center">Śr. cukier</th>
                    <th className="p-3 text-center">Suma Węgli</th>
                    <th className="p-3 text-center">Suma Ins.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  {dailySummaryArray.length === 0 ? (
                    <tr><td colSpan="4" className="p-4 text-center text-gray-500 italic">Brak danych historycznych.</td></tr>
                  ) : (
                    dailySummaryArray.map((row) => (
                      <tr key={row.date} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3 font-bold text-gray-900">{row.date}</td>
                        <td className="p-3 text-center">
                          <span className={row.avgSugar !== '—' && (row.avgSugar > 180 || row.avgSugar < 70) ? "text-red-500 font-black" : "text-gray-900 font-bold"}>
                            {row.avgSugar} {row.avgSugar !== '—' && <span className="text-[10px] font-normal text-gray-400">mg/dl</span>}
                          </span>
                        </td>
                        <td className="p-3 text-center text-blue-600 font-bold">{row.carbs.toFixed(1)}g</td>
                        <td className="p-3 text-center text-emerald-600 font-bold">{row.insulin.toFixed(1)}j.</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}