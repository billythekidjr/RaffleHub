import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    onSnapshot, 
    doc, 
    updateDoc, 
    deleteDoc, 
    setDoc, 
    getDoc, 
    setLogLevel 
} from 'firebase/firestore';
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "firebase/storage";

// --- Firebase Configuration ---
// SOLUTION: Reverted to using the environment-injected variables. The 'process' object
// is not available in this browser environment, causing the ReferenceError. This fix
// safely checks for the global variables provided by the execution environment.
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Initialize Firebase ---
let app, auth, db, storage;
if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    setLogLevel('debug');
} else {
    console.error("Firebase configuration is missing. Make sure environment variables are set correctly.");
}

// --- Stripe Components Placeholder ---
// These will be populated once the Stripe scripts are loaded dynamically.
let Elements, CardElement, useStripe, useElements;

// --- Stripe Payment Component ---
const StripeCheckout = ({ activeRaffle, setPaymentModalOpen, stripeInstance }) => {
    // The Elements provider is now wrapped around the form, receiving the initialized stripeInstance
    return (
        <Elements stripe={stripeInstance}>
            <CheckoutForm activeRaffle={activeRaffle} setPaymentModalOpen={setPaymentModalOpen} />
        </Elements>
    );
};

const CheckoutForm = ({ activeRaffle, setPaymentModalOpen }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);
    const raffleCollectionRef = useRef(collection(db, 'artifacts', appId, 'public', 'data', 'raffles'));

    const ticketPrice = parseFloat(activeRaffle?.ticketPrice || 0);
    const platformFee = ticketPrice * 0.03;
    const totalPrice = ticketPrice + platformFee;

    const handleSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);
        setError(null);

        if (!stripe || !elements) {
            setProcessing(false);
            return;
        }

        const cardElement = elements.getElement(CardElement);
        const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });

        if (paymentMethodError) {
            setError(paymentMethodError.message);
            setProcessing(false);
            return;
        }
        
        console.log('Stripe PaymentMethod:', paymentMethod);
        console.log(`Simulating charge for: $${totalPrice.toFixed(2)}`);

        const user = auth.currentUser;
        if (activeRaffle && user) {
            const updatedEntries = [...activeRaffle.entries, { name: user.email, id: crypto.randomUUID(), userId: user.uid }];
            const raffleDocRef = doc(raffleCollectionRef.current, activeRaffle.id);
            try {
                await updateDoc(raffleDocRef, { entries: updatedEntries });
                setPaymentModalOpen(false);
            } catch (dbError) {
                setError("Payment succeeded, but failed to save entry.");
            }
        }
        setProcessing(false);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-lg space-y-2 text-white">
                <div className="flex justify-between"><span>Ticket Price:</span> <span>${ticketPrice.toFixed(2)}</span></div>
                <div className="flex justify-between text-sm text-gray-400"><span>Platform Fee (3%):</span> <span>${platformFee.toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-lg border-t border-gray-600 pt-2 mt-2"><span>Total:</span> <span>${totalPrice.toFixed(2)}</span></div>
            </div>
            <div className="p-4 bg-gray-700 rounded-lg">
                {CardElement && <CardElement options={{
                    style: {
                        base: { color: '#FFFFFF', fontFamily: '"Helvetica Neue", Helvetica, sans-serif', '::placeholder': { color: '#aab7c4' } },
                        invalid: { color: '#fa755a', iconColor: '#fa755a' }
                    }
                }} />}
            </div>
            {error && <div className="text-red-400 text-sm">{error}</div>}
            <button type="submit" disabled={!stripe || processing} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-300 disabled:bg-gray-600">
                {processing ? 'Processing...' : `Pay $${totalPrice.toFixed(2)}`}
            </button>
        </form>
    );
};


// --- Main App Component ---
function App() {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState({ displayName: '', bio: '' });
    const [raffles, setRaffles] = useState([]);
    const [view, setView] = useState('login');
    const [detailRaffle, setDetailRaffle] = useState(null);
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [newRaffleName, setNewRaffleName] = useState('');
    const [newRaffleDescription, setNewRaffleDescription] = useState('');
    const [newRaffleImageFile, setNewRaffleImageFile] = useState(null);
    const [newRaffleTicketPrice, setNewRaffleTicketPrice] = useState('');
    const [authError, setAuthError] = useState('');
    const [loading, setLoading] = useState(true);

    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [activeRaffleForPayment, setActiveRaffleForPayment] = useState(null);
    
    const [stripeInstance, setStripeInstance] = useState(null);
    
    const raffleCollectionRef = useRef(null);
    const profileCollectionRef = useRef(null);
    
    // --- Dynamic Script Loading for Stripe ---
    useEffect(() => {
        if (window.Stripe) { // If script is already on page, just initialize
             const stripeKey = 'pk_test_51Hh2YBEgC0X0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0';
             setStripeInstance(window.Stripe(stripeKey));
             return;
        }

        const scriptStripe = document.createElement('script');
        scriptStripe.src = 'https://js.stripe.com/v3/';
        scriptStripe.async = true;
        
        scriptStripe.onload = () => {
            const reactStripeScript = document.createElement('script');
            reactStripeScript.src = 'https://unpkg.com/@stripe/react-stripe-js@2.7.1/dist/react-stripe.umd.js';
            reactStripeScript.async = true;
            
            reactStripeScript.onload = () => {
                Elements = window.ReactStripe.Elements;
                CardElement = window.ReactStripe.CardElement;
                useStripe = window.ReactStripe.useStripe;
                useElements = window.ReactStripe.useElements;
                
                const stripeKey = 'pk_test_51Hh2YBEgC0X0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0g0';
                if (stripeKey) {
                    setStripeInstance(window.Stripe(stripeKey));
                } else {
                    console.error("Stripe publishable key is missing.");
                }
            };
            document.body.appendChild(reactStripeScript);
        };

        document.body.appendChild(scriptStripe);

    }, []);

    // --- Auth and Profile Fetching Effect ---
    useEffect(() => {
        if (!auth) {
            setLoading(false);
            return;
        }
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                profileCollectionRef.current = collection(db, 'artifacts', appId, 'public', 'data', 'profiles');
                const profileDocRef = doc(profileCollectionRef.current, currentUser.uid);
                const profileSnap = await getDoc(profileDocRef);
                if (profileSnap.exists()) {
                    setUserProfile(profileSnap.data());
                } else {
                    const defaultProfile = { displayName: currentUser.email, bio: 'New RaffleHub user!' };
                    await setDoc(profileDocRef, defaultProfile);
                    setUserProfile(defaultProfile);
                }
                setView('raffles');
            } else {
                setUser(null);
                setView('login');
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Raffle Data Fetching Effect ---
    useEffect(() => {
        if (user && db) {
            raffleCollectionRef.current = collection(db, 'artifacts', appId, 'public', 'data', 'raffles');
            const unsubscribe = onSnapshot(raffleCollectionRef.current, (snapshot) => {
                const rafflesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setRaffles(rafflesData);
            });
            return () => unsubscribe();
        }
    }, [user]);
    
    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthError('');
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setAuthError(error.message);
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setAuthError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            setAuthError(error.message);
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        if (user && profileCollectionRef.current) {
            const profileDocRef = doc(profileCollectionRef.current, user.uid);
            await updateDoc(profileDocRef, userProfile);
            alert("Profile updated!");
            setView('raffles');
        }
    };

    const createRaffle = async () => {
        const price = parseFloat(newRaffleTicketPrice);
        if (newRaffleName.trim() === '' || isNaN(price) || price <= 0 || !newRaffleImageFile) {
            alert("Please fill all fields, including a valid name, a positive ticket price, and an image.");
            return;
        }
        setLoading(true);
        try {
            const imageRef = ref(storage, `raffles/${appId}/${newRaffleImageFile.name + Date.now()}`);
            const snapshot = await uploadBytes(imageRef, newRaffleImageFile);
            const imageUrl = await getDownloadURL(snapshot.ref);

            await addDoc(raffleCollectionRef.current, {
                name: newRaffleName,
                description: newRaffleDescription,
                imageUrl: imageUrl,
                ticketPrice: price.toFixed(2),
                entries: [],
                winner: null,
                createdAt: new Date(),
                creatorId: user.uid,
                creatorProfile: userProfile,
            });

            setNewRaffleName('');
            setNewRaffleDescription('');
            setNewRaffleImageFile(null);
            setNewRaffleTicketPrice('');
            setView('raffles');
        } catch (error) {
            console.error("Error creating raffle: ", error);
            alert("Failed to create raffle. Please try again.");
        }
        setLoading(false);
    };

    const drawWinner = async (raffleId) => {
        const raffle = raffles.find(r => r.id === raffleId);
        if (raffle && raffle.entries.length > 0) {
            const winnerIndex = Math.floor(Math.random() * raffle.entries.length);
            const winner = raffle.entries[winnerIndex];
            const raffleDocRef = doc(raffleCollectionRef.current, raffleId);
            await updateDoc(raffleDocRef, { winner: winner });
        }
    };
    
    const deleteRaffle = async (raffleId) => {
        await deleteDoc(doc(raffleCollectionRef.current, raffleId));
        setView('raffles');
    };

    const openPaymentModal = (raffle) => {
        setActiveRaffleForPayment(raffle);
        setPaymentModalOpen(true);
    };

    const navigate = (targetView, data = null) => {
        if (targetView === 'detail') {
            setDetailRaffle(data);
        }
        setView(targetView);
    };
    
    const renderNav = () => (
        <nav className="bg-gray-800 p-4 rounded-xl mb-8 flex justify-between items-center">
            <div>
                <button onClick={() => navigate('raffles')} className="text-xl font-bold text-purple-400 hover:text-purple-300">RaffleHub</button>
            </div>
            {user && (
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('create')} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg">Create Raffle</button>
                    <button onClick={() => navigate('profile')} className="text-gray-300 hover:text-white">{userProfile.displayName || 'My Profile'}</button>
                    <button onClick={handleLogout} className="text-gray-400 hover:text-red-400">Logout</button>
                </div>
            )}
        </nav>
    );

    const AuthForm = ({ isLogin }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-md">
                <h2 className="text-3xl font-bold text-center text-purple-400 mb-6">{isLogin ? 'Login' : 'Sign Up'}</h2>
                <form onSubmit={isLogin ? handleLogin : handleSignUp} className="space-y-4">
                    <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-gray-700 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    {authError && <p className="text-red-500 text-sm">{authError}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-600">{loading ? '...' : (isLogin ? 'Login' : 'Sign Up')}</button>
                </form>
                <p className="text-center text-gray-400 mt-4">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                    <button onClick={() => setView(isLogin ? 'signup' : 'login')} className="text-purple-400 hover:underline ml-2">
                        {isLogin ? 'Sign Up' : 'Login'}
                    </button>
                </p>
            </div>
        </div>
    );

    const renderRaffleList = () => (
        <div className="space-y-6">
            {raffles.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate()).map((raffle) => (
                <div key={raffle.id} className="bg-gray-800 rounded-xl shadow-lg overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-300" onClick={() => navigate('detail', raffle)}>
                    <img src={raffle.imageUrl || 'https://placehold.co/600x300/1f2937/3c3c3c?text=No+Image'} alt={raffle.name} className="w-full h-48 object-cover"/>
                    <div className="p-6">
                        <div className="flex justify-between items-start">
                            <h3 className="text-2xl font-bold text-purple-300">{raffle.name}</h3>
                            <p className="text-xl font-bold text-green-400">${raffle.ticketPrice}</p>
                        </div>
                        <p className="text-sm text-gray-400">by {raffle.creatorProfile?.displayName || 'Unknown Creator'}</p>
                        <p className="mt-2 text-gray-300 truncate">{raffle.description}</p>
                    </div>
                </div>
            ))}
        </div>
    );
    
    const renderRaffleDetail = () => {
        const raffle = detailRaffle;
        if(!raffle) return null;
        return (
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                <img src={raffle.imageUrl || 'https://placehold.co/800x400/1f2937/3c3c3c?text=No+Image'} alt={raffle.name} className="w-full h-64 object-cover rounded-lg mb-6"/>
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-4xl font-bold text-purple-300">{raffle.name}</h3>
                    <p className="text-3xl font-bold text-green-400">${raffle.ticketPrice}</p>
                </div>
                <div className="bg-gray-900/50 p-4 rounded-lg mb-4">
                    <h4 className="font-semibold text-gray-300">About the Creator</h4>
                    <p className="font-bold text-white">{raffle.creatorProfile?.displayName}</p>
                    <p className="text-sm text-gray-400">{raffle.creatorProfile?.bio}</p>
                </div>
                <p className="text-gray-300 mb-6 whitespace-pre-wrap">{raffle.description}</p>

                {raffle.winner ? (
                    <div className="text-center bg-yellow-500/20 p-4 rounded-lg">
                        <p className="text-lg">Winner:</p>
                        <p className="text-3xl font-extrabold text-yellow-400">{raffle.winner.name}</p>
                    </div>
                ) : (
                    <>
                        <div className="mt-4">
                            <h4 className="font-semibold mb-2 text-gray-300">Entries ({raffle.entries.length})</h4>
                            <ul className="space-y-2 max-h-40 overflow-y-auto bg-gray-900/50 p-3 rounded-lg">
                                {raffle.entries.map((entry) => <li key={entry.id} className="text-gray-300">{entry.name}</li>)}
                                {raffle.entries.length === 0 && <li className="text-gray-500">No entries yet.</li>}
                            </ul>
                        </div>
                        <div className="mt-4">
                            <button onClick={() => openPaymentModal(raffle)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg">Buy Ticket</button>
                        </div>
                        {raffle.creatorId === user?.uid && (
                            <div className="mt-4 border-t border-gray-700 pt-4 flex gap-4">
                                <button onClick={() => drawWinner(raffle.id)} disabled={raffle.entries.length === 0} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg">Draw Winner</button>
                                <button onClick={() => deleteRaffle(raffle.id)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg">Delete Raffle</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        )
    };

    const renderCreateForm = () => (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-purple-300">Create a New Raffle</h2>
            <div className="space-y-4">
                <input type="text" value={newRaffleName} onChange={(e) => setNewRaffleName(e.target.value)} placeholder="Raffle Name" className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                <textarea value={newRaffleDescription} onChange={(e) => setNewRaffleDescription(e.target.value)} placeholder="Description" rows="4" className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"></textarea>
                <div>
                    <label className="block mb-1 font-semibold text-gray-300">Raffle Image</label>
                    <input type="file" accept="image/*" onChange={(e) => setNewRaffleImageFile(e.target.files[0])} className="w-full text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700"/>
                </div>
                <input type="number" value={newRaffleTicketPrice} onChange={(e) => setNewRaffleTicketPrice(e.target.value)} placeholder="Ticket Price ($)" min="0.01" step="0.01" className="w-full bg-gray-700 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"/>
                <button onClick={createRaffle} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg disabled:bg-gray-600">{loading ? 'Creating...' : 'Create Raffle'}</button>
            </div>
        </div>
    );

    const renderProfilePage = () => (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-3xl font-bold mb-6 text-purple-300">My Profile</h2>
            <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                    <label className="block mb-1 font-semibold text-gray-300">Display Name</label>
                    <input type="text" value={userProfile.displayName} onChange={(e) => setUserProfile({...userProfile, displayName: e.target.value})} className="w-full bg-gray-700 p-3 rounded-lg"/>
                </div>
                <div>
                    <label className="block mb-1 font-semibold text-gray-300">Bio</label>
                    <textarea value={userProfile.bio} onChange={(e) => setUserProfile({...userProfile, bio: e.target.value})} rows="3" className="w-full bg-gray-700 p-3 rounded-lg"></textarea>
                </div>
                <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg">Save Profile</button>
            </form>
        </div>
    );
    
    const renderContent = () => {
        if (loading || !app) return <div className="min-h-screen flex items-center justify-center"><div className="text-center text-xl">Loading...</div></div>;

        switch(view) {
            case 'login': return <AuthForm isLogin={true} />;
            case 'signup': return <AuthForm isLogin={false} />;
            case 'raffles': return renderRaffleList();
            case 'detail': return renderRaffleDetail();
            case 'create': return renderCreateForm();
            case 'profile': return renderProfilePage();
            default: return <AuthForm isLogin={true} />;
        }
    };

    return (
        <div className="bg-gray-900 text-white min-h-screen font-sans">
            {user && (
                 <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
                    {renderNav()}
                    {renderContent()}
                </div>
            )}
            {!user && renderContent()}

            {paymentModalOpen && stripeInstance && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-md relative">
                        <button onClick={() => setPaymentModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
                        <h2 className="text-2xl font-bold text-center mb-4 text-purple-300">Buy Ticket for "{activeRaffleForPayment?.name}"</h2>
                        <StripeCheckout stripeInstance={stripeInstance} activeRaffle={activeRaffleForPayment} setPaymentModalOpen={setPaymentModalOpen} />
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;
