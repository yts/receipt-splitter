export interface LineItem {
  name: string;
  price: number;
  category: string;
  taxable: boolean;
}

export interface CategoryTotals {
  [category: string]: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
}
