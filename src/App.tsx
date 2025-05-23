import { useEffect, useState, useRef } from 'react';

// Types
interface LineItem {
  name: string;
  price: number;
  category: string;
  taxable: boolean;
}

interface CategoryTotals {
  [category: string]: {
    total: number;
    afterTax: number | null;
  };
}

const TAX_RATE_KEY = 'taxRate';
const CATEGORIES_KEY = 'categories';

function App() {
  // Tax Rate
  const [taxRate, setTaxRate] = useState<string>(() => localStorage.getItem(TAX_RATE_KEY) || '');
  useEffect(() => {
    localStorage.setItem(TAX_RATE_KEY, taxRate);
  }, [taxRate]);

  // Categories
  const [categories, setCategories] = useState<string[]>(() => {
    const stored = localStorage.getItem(CATEGORIES_KEY);
    return stored ? JSON.parse(stored) : [];
  });
  useEffect(() => {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  }, [categories]);

  // Line Items
  const [items, setItems] = useState<LineItem[]>([]);
  const [itemInput, setItemInput] = useState<LineItem>({ name: '', price: 0, category: '', taxable: false });
  const [categoryTypeahead, setCategoryTypeahead] = useState<string[]>([]);
  const categoryInputRef = useRef<HTMLInputElement>(null);

  // Totals
  const [categoryTotals, setCategoryTotals] = useState<CategoryTotals>({});
  const [afterTaxTotals, setAfterTaxTotals] = useState<CategoryTotals>({});
  const [taxAdded, setTaxAdded] = useState(false);

  // Handle item input changes
  const handleItemChange = (field: keyof LineItem, value: string | boolean) => {
    setItemInput((prev) => ({ ...prev, [field]: value }));
    if (field === 'category' && typeof value === 'string') {
      setCategoryTypeahead(categories.filter((cat) => cat.toLowerCase().includes(value.toLowerCase())));
    }
  };

  // Add item
  const handleAddItem = () => {
    if (!itemInput.category) return;
    setItems((prev) => [...prev, { ...itemInput, price: Number(itemInput.price) }]);
    if (itemInput.category && !categories.includes(itemInput.category)) {
      setCategories((prev) => [...prev, itemInput.category]);
    }
    setItemInput({ name: '', price: 0, category: '', taxable: false });
    setCategoryTypeahead([]);
  };

  // Calculate totals
  useEffect(() => {
    const totals: CategoryTotals = {};
    items.forEach((item) => {
      if (!totals[item.category]) {
        totals[item.category] = { total: 0, afterTax: null };
      }
      totals[item.category].total += item.price;
    });
    setCategoryTotals(totals);
    setAfterTaxTotals(
      Object.fromEntries(Object.entries(totals).map(([cat, val]) => [cat, { ...val, afterTax: null }]))
    );
    setTaxAdded(false);
  }, [items]);

  // Add tax calculation
  const handleAddTax = () => {
    const rate = parseFloat(taxRate) / 100;
    const newTotals: CategoryTotals = {};
    Object.keys(categoryTotals).forEach((cat) => {
      const catItems = items.filter((item) => item.category === cat);
      const taxableSum = catItems.filter((i) => i.taxable).reduce((sum, i) => sum + i.price, 0);
      const tax = taxableSum * rate;
      newTotals[cat] = {
        total: categoryTotals[cat].total,
        afterTax: +(categoryTotals[cat].total + tax).toFixed(2),
      };
    });
    setAfterTaxTotals(newTotals);
    setTaxAdded(true);
  };

  // Render
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold mb-4">Receipt Splitter</h1>
      {/* Tax Rate Input */}
      <div className="flex items-center gap-4">
        <label htmlFor="taxRate" className="block text-sm font-medium text-gray-700">Tax Rate (%)</label>
        <input
          id="taxRate"
          type="number"
          min="0"
          step="0.01"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
          className="w-32 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>
      {/* Line Item Entry */}
      <div className="flex flex-col gap-2 border p-4 rounded-lg">
        <div className="flex gap-2">
          <input
            placeholder="Item Name (optional)"
            value={itemInput.name}
            onChange={(e) => handleItemChange('name', e.target.value)}
            className="w-40 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <input
            placeholder="Price"
            type="number"
            min="0"
            value={itemInput.price}
            onChange={(e) => handleItemChange('price', e.target.value)}
            className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <div className="relative w-32">
            <input
              ref={categoryInputRef}
              placeholder="Category"
              value={itemInput.category}
              onChange={(e) => handleItemChange('category', e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 w-full"
              autoComplete="off"
            />
            {categoryTypeahead.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1">
                {categoryTypeahead.map((cat) => (
                  <div
                    key={cat}
                    className="px-2 py-1 hover:bg-gray-100 cursor-pointer"
                    onClick={() => {
                      handleItemChange('category', cat);
                      setCategoryTypeahead([]);
                      categoryInputRef.current?.blur();
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <input
              id="taxable"
              type="checkbox"
              checked={itemInput.taxable}
              onChange={(e) => handleItemChange('taxable', e.target.checked)}
              className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <label htmlFor="taxable" className="text-sm font-medium text-gray-700">Taxable</label>
          </div>
          <button
            onClick={handleAddItem}
            className="ml-2 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Add Item
          </button>
        </div>
      </div>
      {/* Items List */}
      <div>
        <table className="w-full border mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Price</th>
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-center">Taxable</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-t">
                <td className="p-2">{item.name}</td>
                <td className="p-2">${item.price.toFixed(2)}</td>
                <td className="p-2">{item.category}</td>
                <td className="p-2 text-center">{item.taxable ? '✔️' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Totals Section */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Totals</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left">Category</th>
              <th className="p-2 text-left">Total</th>
              <th className="p-2 text-left">After Tax</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(categoryTotals).map(([cat, val]) => (
              <tr key={cat} className="border-t">
                <td className="p-2">{cat}</td>
                <td className="p-2">${val.total.toFixed(2)}</td>
                <td className="p-2">{taxAdded && afterTaxTotals[cat]?.afterTax !== null ? `$${afterTaxTotals[cat].afterTax?.toFixed(2)}` : '---'}</td>
              </tr>
            ))}
            <tr className="font-bold border-t">
              <td className="p-2">Total</td>
              <td className="p-2">
                ${Object.values(categoryTotals).reduce((sum, val) => sum + val.total, 0).toFixed(2)}
              </td>
              <td className="p-2">
                {taxAdded
                  ? `$${Object.values(afterTaxTotals).reduce((sum, val) => sum + (val.afterTax ?? 0), 0).toFixed(2)}`
                  : '---'}
              </td>
            </tr>
          </tbody>
        </table>
        <button
          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          onClick={handleAddTax}
        >
          Add Tax
        </button>
      </div>
    </div>
  );
}

export default App;
