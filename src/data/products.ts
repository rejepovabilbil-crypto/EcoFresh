export interface Product {
  id: string;
  name: string;
  category: 'Leafy Greens' | 'Herbs' | 'Microgreens' | 'Fruiting Plants';
  description: string;
  price: number;
  unit: string;
  stock: number;
  min_stock: number;
  max_stock: number;
  reserved_quantity: number;
  damaged_quantity: number;
  image: string;
  featured?: boolean;
  active: boolean;
}

export const products: Product[] = [
  {
    id: 'butterhead-lettuce',
    name: 'Butterhead Lettuce',
    category: 'Leafy Greens',
    description: 'Tender, buttery leaves with a delicate sweet flavor, perfect for salads and wraps.',
    price: 6.50,
    unit: 'per head',
    stock: 24,
    image: 'https://images.pexels.com/photos/37154679/pexels-photo-37154679.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'romaine-lettuce',
    name: 'Romaine Lettuce',
    category: 'Leafy Greens',
    description: 'Crisp, crunchy romaine hearts with a refreshing taste, ideal for Caesar salads.',
    price: 5.50,
    unit: 'per head',
    stock: 18,
    image: 'https://images.pexels.com/photos/5202194/pexels-photo-5202194.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'kale-bunch',
    name: 'Kale Bunch',
    category: 'Leafy Greens',
    description: 'Nutrient-dense curly kale with deep green leaves, packed with vitamins and antioxidants.',
    price: 7.00,
    unit: 'per bunch',
    stock: 14,
    image: 'https://images.pexels.com/photos/6632211/pexels-photo-6632211.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'swiss-chard',
    name: 'Swiss Chard',
    category: 'Leafy Greens',
    description: 'Vibrant rainbow chard with glossy leaves and colorful stems, mild and earthy.',
    price: 6.00,
    unit: 'per bunch',
    stock: 9,
    image: 'https://images.pexels.com/photos/32635106/pexels-photo-32635106.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'spinach',
    name: 'Spinach',
    category: 'Leafy Greens',
    description: 'Fresh, tender baby spinach leaves with a mild flavor, great for smoothies and sautés.',
    price: 5.00,
    unit: 'per bag',
    stock: 22,
    image: 'https://images.pexels.com/photos/4506881/pexels-photo-4506881.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'arugula',
    name: 'Arugula',
    category: 'Leafy Greens',
    description: 'Peppery, bold-flavored arugula leaves that add a zesty kick to any dish.',
    price: 5.50,
    unit: 'per bag',
    stock: 16,
    image: 'https://images.pexels.com/photos/4519012/pexels-photo-4519012.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'fresh-basil',
    name: 'Fresh Basil',
    category: 'Herbs',
    description: 'Aromatic sweet basil with fragrant leaves, essential for pesto and Italian cuisine.',
    price: 5.00,
    unit: 'per bunch',
    stock: 20,
    image: 'https://images.pexels.com/photos/11789833/pexels-photo-11789833.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'mint-leaves',
    name: 'Mint Leaves',
    category: 'Herbs',
    description: 'Cool, refreshing mint leaves perfect for teas, mocktails, and Middle Eastern dishes.',
    price: 4.00,
    unit: 'per bunch',
    stock: 15,
    image: 'https://images.pexels.com/photos/36435666/pexels-photo-36435666.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'cilantro',
    name: 'Cilantro',
    category: 'Herbs',
    description: 'Bright, citrusy cilantro leaves that elevate salsas, curries, and garnishes.',
    price: 3.50,
    unit: 'per bunch',
    stock: 0,
    image: 'https://images.pexels.com/photos/10048317/pexels-photo-10048317.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'microgreens-mix',
    name: 'Microgreens Mix',
    category: 'Microgreens',
    description: 'A vibrant blend of nutrient-packed microgreens with intense flavor and crunch.',
    price: 12.00,
    unit: 'per tray',
    stock: 12,
    image: 'https://images.pexels.com/photos/8543138/pexels-photo-8543138.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'radish-microgreens',
    name: 'Radish Microgreens',
    category: 'Microgreens',
    description: 'Spicy, crisp radish microgreens that add a peppery punch and vibrant color.',
    price: 10.00,
    unit: 'per tray',
    stock: 7,
    image: 'https://images.pexels.com/photos/15874888/pexels-photo-15874888.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'sunflower-microgreens',
    name: 'Sunflower Microgreens',
    category: 'Microgreens',
    description: 'Nutty, crunchy sunflower microgreens with a satisfying texture and rich nutrients.',
    price: 11.00,
    unit: 'per tray',
    stock: 10,
    image: 'https://images.pexels.com/photos/9031151/pexels-photo-9031151.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'cherry-tomatoes',
    name: 'Cherry Tomatoes',
    category: 'Fruiting Plants',
    description: 'Sweet, juicy cherry tomatoes grown hydroponically for concentrated flavor year-round.',
    price: 14.00,
    unit: 'per punnet',
    stock: 30,
    image: 'https://images.pexels.com/photos/30825690/pexels-photo-30825690.jpeg?auto=compress&cs=tinysrgb&w=800',
    featured: true,
  },
  {
    id: 'bell-peppers',
    name: 'Bell Peppers',
    category: 'Fruiting Plants',
    description: 'Crisp, colorful bell peppers with thick walls and a sweet, refreshing crunch.',
    price: 8.00,
    unit: 'per piece',
    stock: 5,
    image: 'https://images.pexels.com/photos/35614119/pexels-photo-35614119.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
  {
    id: 'strawberries',
    name: 'Strawberries',
    category: 'Fruiting Plants',
    description: 'Plump, aromatic strawberries grown vertically for peak sweetness and freshness.',
    price: 18.00,
    unit: 'per punnet',
    stock: 0,
    image: 'https://images.pexels.com/photos/36950051/pexels-photo-36950051.jpeg?auto=compress&cs=tinysrgb&w=800',
  },
];

export const categories = ['All', 'Leafy Greens', 'Herbs', 'Microgreens', 'Fruiting Plants'] as const;