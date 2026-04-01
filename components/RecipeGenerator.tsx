import React, { useState, useCallback, useMemo } from 'react';
import { getRecipesForIngredients } from '../services/geminiService';
import { ProductListing, RecipeResponse, Recipe } from '../types';
import Card from './common/Card';
import Button from './common/Button';
import Spinner from './common/Spinner';
import Icon from './common/Icon';

interface RecipeGeneratorProps {
    allListings: ProductListing[];
    onIngredientClick: (ingredientName: string) => void;
}

const RecipeGenerator: React.FC<RecipeGeneratorProps> = ({ allListings, onIngredientClick }) => {
    const [pantryItems, setPantryItems] = useState<string[]>(['Paneer', 'Spinach', 'Ginger', 'Onion']);
    const [newItemInput, setNewItemInput] = useState('');
    const [recipes, setRecipes] = useState<RecipeResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('All Recipes');
    const [recipeCount, setRecipeCount] = useState(3);

    // Default to no preferences selected to satisfy user feedback
    const [selectedDietaryPrefs, setSelectedDietaryPrefs] = useState<string[]>([]);

    const dietaryOptions = [
        { id: 'vegetarian', label: 'Vegetarian' },
        { id: 'gluten-free', label: 'Gluten-Free' },
        { id: 'high-protein', label: 'High Protein' },
    ];

    const toggleDietaryPref = (id: string) => {
        setSelectedDietaryPrefs(prev => 
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleAddPantryItem = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = newItemInput.trim();
        if (trimmed && !pantryItems.includes(trimmed)) {
            setPantryItems([...pantryItems, trimmed]);
            setNewItemInput('');
        }
    };

    const handleRemovePantryItem = (itemToRemove: string) => {
        setPantryItems(pantryItems.filter(item => item !== itemToRemove));
    };

    const generateRecipes = async () => {
        if (pantryItems.length === 0) {
            setError('Add at least one ingredient to your pantry.');
            return;
        }
        setLoading(true);
        setError(null);
        setRecipes(null);
        try {
            // Filter unique fresh produce names currently on sale
            const availableCrops: string[] = Array.from(new Set(allListings
                .filter(l => l.listingType === 'retail' && l.quantity > 0)
                .map(l => l.cropName)));
            
            // Passing selected dietary preferences and recipe count to the AI service
            const data = await getRecipesForIngredients(pantryItems, availableCrops, selectedDietaryPrefs, recipeCount);
            if (!data || !data.recipes || !Array.isArray(data.recipes)) {
                throw new Error("Our AI Chef couldn't find recipes. Try adding more common ingredients.");
            }
            setRecipes(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Our AI Chef is busy crafting. Try again shortly.');
        } finally {
            setLoading(false);
        }
    };

    const processedRecipes = useMemo(() => {
        if (!recipes || !Array.isArray(recipes.recipes)) return [];
        return recipes.recipes.map(recipe => {
            const recipeIngredients = recipe.ingredients || [];
            const pantryLower = pantryItems.map(p => p.toLowerCase());
            
            const matchedCount = recipeIngredients.filter(ri => 
                pantryLower.some(p => ri.name.toLowerCase().includes(p) || p.includes(ri.name.toLowerCase()))
            ).length;

            const matchPercentage = recipeIngredients.length > 0 
                ? Math.round((matchedCount / recipeIngredients.length) * 100) 
                : 0;

            // CROSS-REFERENCE WITH MARKET: Find ingredients NOT in pantry but AVAILABLE in market
            const missingItems = recipeIngredients.filter(ri => 
                !pantryLower.some(p => ri.name.toLowerCase().includes(p) || p.includes(ri.name.toLowerCase()))
            ).map(ri => {
                const searchName = ri.name.toLowerCase().replace(/s$/, ''); // singularize
                const listing = allListings.find(l => 
                    l.listingType === 'retail' && 
                    l.quantity > 0 && 
                    (l.cropName.toLowerCase().includes(searchName) || searchName.includes(l.cropName.toLowerCase()))
                );
                return {
                    ...ri,
                    onMarket: !!listing,
                    farmName: listing?.farmerName || 'Local Farm',
                    price: listing?.price || 0,
                    currency: listing?.currency || 'INR'
                };
            });

            // Calculate total cost for items available on market
            const totalToBuy = missingItems
                .filter(mi => mi.onMarket)
                .reduce((sum, mi) => sum + mi.price, 0);

            return {
                ...recipe,
                matchPercentage,
                matchedCount,
                missingItems,
                totalToBuy
            };
        });
    }, [recipes, pantryItems, allListings]);

    return (
        <div className="flex flex-col lg:flex-row gap-8 bg-transparent">
            {/* Sidebar: Smart Pantry */}
            <aside className="w-full lg:w-1/4 space-y-6">
                <Card className="!p-6 border-none shadow-md">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <Icon name="shopping-basket" className="h-5 w-5 text-green-600" />
                        </div>
                        <h2 className="text-lg font-bold text-gray-800">Smart Pantry</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">Add ingredients you have at home to generate recipes.</p>

                    <form onSubmit={handleAddPantryItem} className="relative mb-6">
                        <input
                            type="text"
                            value={newItemInput}
                            onChange={(e) => setNewItemInput(e.target.value)}
                            placeholder="Add e.g., Paneer, Dal"
                            className="w-full p-3 pr-12 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none transition-shadow"
                        />
                        <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 hover:text-green-700">
                            <Icon name="plus" className="h-5 w-5" />
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-2 mb-8">
                        {pantryItems.map(item => (
                            <span key={item} className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-semibold border border-green-100 group animate-fade-in">
                                {item}
                                <button onClick={() => handleRemovePantryItem(item)} className="text-green-300 hover:text-green-600">
                                    <Icon name="x-mark" className="h-4 w-4" />
                                </button>
                            </span>
                        ))}
                    </div>

                    <div className="space-y-4 border-t pt-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Dietary Preferences</h3>
                        <div className="space-y-3">
                            {dietaryOptions.map(option => {
                                const isChecked = selectedDietaryPrefs.includes(option.id);
                                return (
                                    <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
                                        <div 
                                            onClick={() => toggleDietaryPref(option.id)}
                                            className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-green-500 border-green-500 shadow-sm' : 'border-gray-300 group-hover:border-green-400'}`}
                                        >
                                            {isChecked && <Icon name="check" className="h-3 w-3 text-white" />}
                                        </div>
                                        <span 
                                            onClick={() => toggleDietaryPref(option.id)}
                                            className={`text-sm font-medium ${isChecked ? 'text-gray-800' : 'text-gray-500'}`}
                                        >
                                            {option.label}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-4 border-t pt-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recipe Count</h3>
                        <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                            {[3, 5, 7, 10].map(count => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => setRecipeCount(count)}
                                    className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all ${
                                        recipeCount === count 
                                        ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' 
                                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100/50'
                                    }`}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                    </div>

                    <Button 
                        onClick={generateRecipes} 
                        disabled={loading} 
                        className="w-full mt-4 !bg-gradient-to-r !from-green-500 !to-emerald-600 !hover:from-green-600 !hover:to-emerald-700 !rounded-xl !py-4 font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all"
                    >
                        {loading ? <Spinner /> : <><Icon name="sparkles" className="h-5 w-5" /> Generate Recipes</>}
                    </Button>
                </Card>
            </aside>

            {/* Main Content Area */}
            <main className="w-full lg:w-3/4">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 bg-white/50 p-2 rounded-2xl border border-white/50 backdrop-blur-sm shadow-sm">
                    <div className="flex gap-2 p-1">
                        {['All Recipes', 'Curries', 'Rice Items', 'Under 30m'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-gray-800 shadow-md ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400 pr-4">
                        <span>Sort by:</span>
                        <select className="font-bold text-gray-700 bg-transparent outline-none cursor-pointer hover:text-green-600">
                            <option>Best Match</option>
                            <option>Quickest</option>
                            <option>Most Available</option>
                        </select>
                    </div>
                </div>

                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {[...Array(recipeCount)].map((_, i) => (
                             <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm animate-pulse border">
                                 <div className="h-56 bg-gray-200" />
                                 <div className="p-6 space-y-4">
                                     <div className="h-6 bg-gray-200 rounded-full w-3/4" />
                                     <div className="h-4 bg-gray-200 rounded-full w-full" />
                                     <div className="space-y-2 pt-4">
                                         <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                                         <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                                     </div>
                                 </div>
                             </div>
                         ))}
                    </div>
                )}

                {error && (
                    <div className="p-12 text-center bg-red-50 text-red-600 rounded-3xl border border-red-100 shadow-inner">
                        <Icon name="alert-triangle" className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="font-bold text-lg">{error}</p>
                    </div>
                )}

                {!loading && processedRecipes.length === 0 && !error && (
                    <div className="py-32 text-center bg-white/50 rounded-3xl border border-dashed border-gray-300">
                         <Icon name="book-open" className="h-20 w-20 mx-auto mb-6 opacity-10 text-green-800" />
                         <h3 className="text-2xl font-black text-gray-400">Your Recipe Book Awaits</h3>
                         <p className="text-gray-400 mt-2">Adjust your pantry items and click "Generate Recipes"</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {processedRecipes.map((recipe, idx) => (
                        <Card key={idx} className="!p-0 border-none shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 animate-fade-in group rounded-3xl bg-white">
                            <div className="relative h-64 w-full">
                                {recipe.imageUrl ? (
                                    <img src={recipe.imageUrl || undefined} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                ) : (
                                    <div className="w-full h-full bg-green-50 flex items-center justify-center"><Icon name="leaf" className="h-16 w-16 text-green-200" /></div>
                                )}
                                <div className="absolute top-4 left-4 flex gap-2">
                                    <span className="bg-green-500/95 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1 backdrop-blur-md shadow-lg">
                                        <Icon name="check-circle" className="h-3 w-3" /> {recipe.matchPercentage}% Match
                                    </span>
                                    <span className="bg-black/60 text-white text-[10px] font-black px-3 py-1.5 rounded-full flex items-center gap-1 backdrop-blur-md">
                                        <Icon name="clock" className="h-3 w-3" /> {recipe.prepTime}
                                    </span>
                                </div>
                                <button className="absolute top-4 right-4 bg-white/30 p-2.5 rounded-full backdrop-blur-md text-white hover:bg-white hover:text-red-500 transition-all shadow-lg active:scale-90">
                                    <Icon name="heart" className="h-5 w-5" />
                                </button>
                            </div>
                            
                            <div className="p-8">
                                <h3 className="text-2xl font-black text-gray-800 group-hover:text-green-600 transition-colors leading-tight">{recipe.title}</h3>
                                <p className="text-sm text-gray-500 mt-3 line-clamp-2 leading-relaxed">{recipe.description}</p>
                                
                                <div className="mt-8 pt-8 border-t border-gray-50">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Pantry Match</h4>
                                        <span className="text-[11px] font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{recipe.matchedCount}/{recipe.ingredients.length} ITEMS</span>
                                    </div>
                                    
                                    <ul className="space-y-4">
                                        {/* Items in Pantry */}
                                        <li className="flex items-start gap-3">
                                            <div className="mt-1 p-0.5 bg-green-100 rounded-full">
                                                <Icon name="check-circle" className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                                            </div>
                                            <span className="text-xs text-gray-600 font-bold leading-tight">
                                                Have: {recipe.ingredients.filter(i => pantryItems.some(p => i.name.toLowerCase().includes(p.toLowerCase()))).map(i => i.name).join(', ') || 'None'}
                                            </span>
                                        </li>

                                        {/* Items on Market */}
                                        {recipe.missingItems.filter(mi => mi.onMarket).map((mi, i) => (
                                            <li key={i} className="flex justify-between items-center group/item p-3 rounded-2xl bg-orange-50/30 border border-orange-100/50 hover:bg-orange-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <Icon name="shopping-bag" className="h-5 w-5 text-orange-400" />
                                                    <div>
                                                        <span className="text-sm text-gray-800 font-black block">{mi.name}</span>
                                                        <span className="text-[10px] font-bold text-orange-600/70 tracking-tight uppercase">{mi.farmName}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-black text-gray-800">₹{mi.price.toFixed(2)}</p>
                                                    <button 
                                                        onClick={() => onIngredientClick(mi.name)}
                                                        className="text-[9px] font-black text-blue-500 uppercase tracking-tighter hover:underline"
                                                    >
                                                        Find Now
                                                    </button>
                                                </div>
                                            </li>
                                        ))}

                                        {/* Truly Missing Items */}
                                        {recipe.missingItems.filter(mi => !mi.onMarket).map((mi, i) => (
                                            <li key={i} className="flex items-center gap-3 px-3 py-1 text-gray-400">
                                                <Icon name="x-mark" className="h-4 w-4 opacity-30" />
                                                <span className="text-xs italic">{mi.name} (Missing from market)</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-10 flex items-center justify-between bg-gray-50/80 p-6 rounded-3xl">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Cost to complete</p>
                                        <p className="text-2xl font-black text-gray-800">₹{recipe.totalToBuy.toFixed(2)}</p>
                                    </div>
                                    <button 
                                        className="bg-green-600 hover:bg-green-700 text-white font-black py-4 px-8 rounded-2xl flex items-center gap-2 transition-all active:scale-95 shadow-xl shadow-green-600/20 disabled:opacity-50 disabled:grayscale"
                                        onClick={() => recipe.missingItems.forEach(mi => mi.onMarket && onIngredientClick(mi.name))}
                                        disabled={recipe.totalToBuy === 0}
                                    >
                                        Shop Recipe <Icon name="arrow-right" className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}

                    {processedRecipes.length > 0 && (
                        <div className="md:col-span-2 mt-12 group">
                            <div className="bg-gradient-to-br from-[#0c261e] to-[#05110e] p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10 text-center md:text-left">
                                    <div className="bg-white/5 p-6 rounded-[2rem] backdrop-blur-2xl border border-white/10 shadow-inner group-hover:rotate-12 transition-transform duration-700">
                                        <Icon name="sparkles" className="h-12 w-12 text-green-400" />
                                    </div>
                                    <div className="flex-grow max-w-lg">
                                        <h3 className="text-3xl font-black text-white mb-3">Want more variety?</h3>
                                        <p className="text-base text-white/50 leading-relaxed font-medium">Our AI can analyze your past orders to suggest personalized meal plans that minimize food waste.</p>
                                    </div>
                                    <button className="whitespace-nowrap bg-green-500/10 hover:bg-green-500/20 text-green-400 font-black px-10 py-5 rounded-2xl border border-green-500/30 transition-all active:scale-95 text-lg">
                                        Connect Order History
                                    </button>
                                </div>
                                <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 blur-[120px] -translate-y-1/2 translate-x-1/2 rounded-full" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 blur-[100px] translate-y-1/2 -translate-x-1/2 rounded-full" />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default RecipeGenerator;
