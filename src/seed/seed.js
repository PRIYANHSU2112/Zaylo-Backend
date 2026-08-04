/**
 * Seed staff users, categories, CMS/settings from Frontend content shapes,
 * sample banners/blogs/gallery, and a few Active products.
 *
 * Usage: node src/seed/seed.js
 */
import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import config from '../config/index.js';
import User from '../models/User.js';
import Category from '../models/Category.js';
import Product from '../models/Product.js';
import Settings from '../models/Settings.js';
import CmsContent from '../models/CmsContent.js';
import Announcement from '../models/Announcement.js';
import Promo from '../models/Promo.js';
import Blog from '../models/Blog.js';
import Gallery from '../models/Gallery.js';
import Bundle from '../models/Bundle.js';
import logger from '../utils/logger.js';

const cmsPayload = {
  key: 'home',
  about: {
    story:
      "ZAY'LO Snacks was born from a simple belief — every Indian deserves premium quality snacks at an affordable price. What started as a small manufacturing unit has grown into a beloved brand across 12+ states, winning hearts with our tagline Swad Jo Dil Jeet Le.",
    mission:
      'To deliver premium, affordable snacks that bring joy to every Indian household while maintaining the highest standards of quality and food safety.',
    vision:
      "To become India's most loved FMCG snack brand, recognized globally for quality, innovation, and value.",
    timeline: [
      { year: '2010', title: 'Foundation', desc: "ZAY'LO Snacks founded with a vision for affordable premium snacks." },
      { year: '2014', title: 'First Million', desc: 'Crossed 1 million packs sold. Expanded to 3 states.' },
      { year: '2018', title: 'ISO Certification', desc: 'Achieved ISO 22000 food safety certification.' },
      { year: '2021', title: '5000 Stores', desc: 'Reached 5000+ retail touchpoints across India.' },
      { year: '2024', title: 'Product Expansion', desc: 'Launched Katori, 5PM Pasta, and Zig Zac. 7 SKUs strong.' },
      { year: '2026', title: 'National Brand', desc: 'Expanding to 20+ states with new categories coming soon.' },
    ],
    values: [
      { title: 'Quality First', desc: 'Never compromise on ingredients or manufacturing standards.' },
      { title: 'Affordability', desc: 'Premium taste accessible to every family at ₹5.' },
      { title: 'Innovation', desc: 'Constantly developing new flavours and product formats.' },
      { title: 'Integrity', desc: 'Transparent practices from factory to retail shelf.' },
    ],
    awards: [
      'Best Snack Brand 2024',
      'FMCG Excellence Award',
      'Made in India Champion',
      'Consumer Choice Gold',
    ],
  },
  testimonials: [
    {
      name: 'Rajesh Kumar',
      role: 'Retailer, Delhi NCR',
      rating: 5,
      text: "ZAY'LO products fly off our shelves. At ₹5, the quality is unbeatable.",
      avatar: 'RK',
      position: 0,
    },
    {
      name: 'Priya Sharma',
      role: 'Homemaker, Mumbai',
      rating: 5,
      text: 'My kids love Zig Zac and Katori. Finally a snack brand I trust.',
      avatar: 'PS',
      position: 1,
    },
    {
      name: 'Amit Patel',
      role: 'Distributor, Gujarat',
      rating: 5,
      text: "Partnering with ZAY'LO was the best business decision.",
      avatar: 'AP',
      position: 2,
    },
    {
      name: 'Sneha Reddy',
      role: 'Cafe Owner, Hyderabad',
      rating: 4,
      text: "We use ZAY'LO snacks in our cafe combos. Premium taste, premium brand.",
      avatar: 'SR',
      position: 3,
    },
  ],
  trustedBy: ['Reliance Fresh', 'DMart', 'Big Bazaar', 'More', "Spencer's", 'Easyday'],
  whyChoose: [
    {
      title: 'Premium Quality',
      description: '100% premium ingredients. ISO certified manufacturing.',
      icon: 'award',
    },
    {
      title: 'Affordable at ₹5',
      description: 'Premium taste without the premium price.',
      icon: 'tag',
    },
    {
      title: 'Wide Variety',
      description: '7 unique products and growing.',
      icon: 'grid',
    },
    {
      title: 'Pan-India Reach',
      description: 'Available across 5000+ retail stores.',
      icon: 'map',
    },
  ],
  trustStats: [
    { value: '15+', label: 'Years Experience' },
    { value: '2M+', label: 'Happy Customers' },
    { value: '5000+', label: 'Retail Stores' },
    { value: '12+', label: 'States Covered' },
  ],
  faqs: [
    {
      q: "Are all ZAY'LO products vegetarian?",
      a: "Yes, all ZAY'LO Snacks products are 100% vegetarian.",
    },
    {
      q: "Where can I buy ZAY'LO products?",
      a: "ZAY'LO is available at 5000+ retail stores across India.",
    },
    {
      q: "How do I become a ZAY'LO dealer?",
      a: 'Visit our Dealer page and fill out the registration form.',
    },
    {
      q: "What is the MRP of ZAY'LO products?",
      a: "All current ZAY'LO products are priced at ₹5 MRP.",
    },
    {
      q: 'Do you offer bulk/corporate orders?',
      a: 'Yes! Contact us for bulk pricing.',
    },
  ],
  dealerBenefits: [
    {
      title: 'High Margins',
      desc: 'Industry-leading dealer margins with volume-based incentives.',
    },
    {
      title: 'Marketing Support',
      desc: 'POS materials, digital assets, and co-branded promotions.',
    },
    {
      title: 'Training & Onboarding',
      desc: 'Complete product training and territory management support.',
    },
    {
      title: 'Exclusive Territories',
      desc: 'Protected dealer territories with dedicated area managers.',
    },
  ],
  dealerFaqs: [
    {
      q: 'What is the minimum investment?',
      a: 'Initial investment starts from ₹50,000 depending on territory size.',
    },
    {
      q: 'How long does approval take?',
      a: 'Applications are reviewed within 48 hours.',
    },
    {
      q: 'Do you provide credit terms?',
      a: 'Yes, approved dealers receive flexible credit terms.',
    },
  ],
};

const settingsPayload = {
  key: 'default',
  corporate: {
    title: 'Corporate Office',
    address:
      "ZAY'LO Snacks Pvt. Ltd., Plot No. 45, Industrial Area, Phase-II, New Delhi - 110020",
    phone: '+91 98765 43210',
    email: 'info@zaylosnacks.com',
  },
  factory: {
    title: 'Manufacturing Unit',
    address: "ZAY'LO Foods, Survey No. 128, Food Park, Sonipat, Haryana - 131001",
    phone: '+91 98765 43211',
    email: 'factory@zaylosnacks.com',
  },
  whatsapp: '+91 98765 43210',
  salesTeam: [
    { name: 'North India', contact: 'north@zaylosnacks.com', phone: '+91 98765 43212' },
    { name: 'West India', contact: 'west@zaylosnacks.com', phone: '+91 98765 43213' },
    { name: 'South India', contact: 'south@zaylosnacks.com', phone: '+91 98765 43214' },
  ],
  brand: {
    legalName: "ZAY'LO Snacks Pvt. Ltd.",
    shortDescription:
      "Swad Jo Dil Jeet Le — Premium Indian snacks at ₹5. Quality you can trust, taste you'll love, delivered fresh to your door.",
    logoUrl: '',
    siteUrl: 'https://zaylosnacks.com',
    ogImageUrl: 'https://zaylosnacks.com/images/og-image.png',
  },
  social: {
    instagram: 'https://instagram.com/zaylosnacks',
    facebook: '',
    youtube: '',
    linkedin: '',
    twitter: '',
    instagramHandle: '@zaylosnacks',
  },
  footer: {
    copyrightText: "ZAY'LO Snacks Pvt. Ltd. All rights reserved.",
    privacyPolicyUrl: '/privacy',
    termsUrl: '/terms',
  },
  map: {
    label: 'Sonipat, Haryana — Manufacturing Hub',
    embedUrl: '',
  },
  general: {
    siteName: "ZAY'LO Snacks",
    siteTagline: 'Swad Jo Dil Jeet Le',
    themeDefault: 'emerald',
    modeDefault: 'light',
    allowRegistrations: true,
    maintenanceMode: false,
  },
};

const sampleProducts = [
  {
    slug: 'moon-lite',
    name: 'Moon Lite',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Crispy Delight',
    description: 'Golden cup-shaped puffed snacks with a perfect crunch.',
    rating: 4.8,
    reviewCount: 1240,
    isVeg: true,
    isNew: false,
    flavor: 'Tomato Masala',
    nutrition: { calories: 480, fat: '22g', protein: '6g', carbs: '62g' },
    ingredients: ['Corn Grits', 'Edible Vegetable Oil', 'Spices & Condiments', 'Salt', 'Tomato Powder'],
    storage: 'Store in a cool, dry place. Keep away from direct sunlight.',
    status: 'Active',
    stock: 120,
    image:
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd08c?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: 'katori',
    name: 'Katori',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Crispy Delight',
    description: 'Bowl-shaped crispy snacks crafted for the perfect munch.',
    rating: 4.7,
    reviewCount: 980,
    isVeg: true,
    isNew: true,
    flavor: 'Tomato Ketchup',
    nutrition: { calories: 465, fat: '20g', protein: '5g', carbs: '64g' },
    ingredients: ['Corn Grits', 'Edible Vegetable Oil', 'Spices', 'Tomato Seasoning', 'Salt'],
    storage: 'Store in a cool, dry place. Once opened, consume within 3 days.',
    status: 'Active',
    stock: 45,
    image:
      'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: 'dhamal-chokdi',
    name: 'Dhamal Chokdi',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Spicy Cross Crunch',
    description: 'Unique cross-shaped puffed crisps with bold masala seasoning.',
    rating: 4.6,
    reviewCount: 870,
    isVeg: true,
    isNew: false,
    flavor: 'Masala',
    nutrition: { calories: 490, fat: '23g', protein: '5g', carbs: '60g' },
    ingredients: ['Corn Grits', 'Edible Vegetable Oil', 'Red Chilli', 'Garlic', 'Spices', 'Salt'],
    storage: 'Store in airtight container after opening.',
    status: 'Active',
    stock: 80,
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: 'noodles',
    name: 'Noodles',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Crispy & Crunchy',
    description: "Extruded cereal sticks fried to golden perfection. ZAY'LO Noodles.",
    rating: 4.9,
    reviewCount: 2100,
    isVeg: true,
    isNew: false,
    flavor: 'Classic Masala',
    nutrition: { calories: 510, fat: '24g', protein: '7g', carbs: '58g' },
    ingredients: ['Cereals', 'Edible Vegetable Oil', 'Spices', 'Green Peas', 'Tomato', 'Salt'],
    storage: 'Store in cool, dry place. Best before date on pack.',
    status: 'Active',
    stock: 200,
    image:
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: '5pm-pasta',
    name: '5PM Pasta',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Italian Peri Peri Masala',
    description: 'Penne-shaped pasta snacks with peri peri masala coating.',
    rating: 4.8,
    reviewCount: 1560,
    isVeg: true,
    isNew: true,
    flavor: 'Peri Peri Masala',
    nutrition: { calories: 475, fat: '21g', protein: '6g', carbs: '61g' },
    ingredients: ['Corn Flour', 'Edible Vegetable Oil', 'Peri Peri Seasoning', 'Tomato Powder', 'Salt'],
    storage: 'Keep in cool, dry place away from moisture.',
    status: 'Active',
    stock: 90,
    image:
      'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: 'salted-pipe',
    name: 'Salted Pipe',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Spicy & Yummy Taste',
    description: 'Hollow pipe-shaped extruded snacks with a perfectly salted crunch.',
    rating: 4.5,
    reviewCount: 720,
    isVeg: true,
    isNew: false,
    flavor: 'Salted',
    nutrition: { calories: 450, fat: '18g', protein: '4g', carbs: '65g' },
    ingredients: ['Corn Grits', 'Edible Vegetable Oil', 'Salt', 'Spices'],
    storage: 'Store in cool, dry place. Reseal after opening.',
    status: 'Active',
    stock: 60,
    image:
      'https://images.unsplash.com/photo-1599490659213-e2b9527bd08c?q=80&w=300&auto=format&fit=crop',
  },
  {
    slug: 'zig-zac',
    name: 'Zig Zac',
    category: 'namkeen',
    price: 5,
    mrp: 5,
    weight: '1 Pack',
    tagline: 'Spicy Flavour Delicious',
    description: 'Crinkle-cut rectangular chips with bold spicy seasoning.',
    rating: 4.7,
    reviewCount: 1340,
    isVeg: true,
    isNew: false,
    flavor: 'Spicy',
    nutrition: { calories: 495, fat: '22g', protein: '5g', carbs: '63g' },
    ingredients: ['Potato Starch', 'Corn Grits', 'Edible Vegetable Oil', 'Green Chilli', 'Spices', 'Salt'],
    storage: 'Store in cool, dry place. Consume before expiry.',
    status: 'Active',
    stock: 110,
    image:
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=300&auto=format&fit=crop',
  },
];

async function ensureUser(email, payload) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create(payload);
    logger.info(`Created user ${email}`);
  }
  return user;
}

async function seed() {
  await mongoose.connect(config.mongodbUri);

  await ensureUser('admin@zaylo.com', {
    name: 'Zaylo Admin',
    email: 'admin@zaylo.com',
    phone: '',
    password: 'Admin123!',
    role: 'Admin',
    status: 'Active',
  });

  await ensureUser('manager@zaylo.com', {
    name: 'Zaylo Manager',
    email: 'manager@zaylo.com',
    password: 'Manager123!',
    role: 'Manager',
    status: 'Active',
  });

  if (!(await Category.findOne({ slug: 'namkeen' }))) {
    await Category.create({
      name: 'Namkeen',
      slug: 'namkeen',
      comingSoon: false,
      color: 'from-amber-400 to-orange-500',
      homePosition: 0,
      status: 'Active',
    });
    logger.info('Created category namkeen');
  } else {
    await Category.updateOne({ slug: 'namkeen' }, { $set: { homePosition: 0 } });
  }

  const popularSlugs = ['moon-lite', 'katori', 'zig-zac', 'noodles'];
  for (let i = 0; i < sampleProducts.length; i++) {
    const p = sampleProducts[i];
    const popularIdx = popularSlugs.indexOf(p.slug);
    await Product.findOneAndUpdate(
      { slug: p.slug },
      {
        ...p,
        isPopular: popularIdx >= 0,
        homePosition: popularIdx >= 0 ? popularIdx : 99,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  }
  logger.info('Upserted sample products (popular flagged)');

  await Settings.findOneAndUpdate({ key: 'default' }, settingsPayload, {
    upsert: true,
    new: true,
  });
  logger.info('Seeded settings from Frontend contactInfo');

  await CmsContent.findOneAndUpdate({ key: 'home' }, cmsPayload, {
    upsert: true,
    new: true,
  });
  logger.info('Seeded CMS from Frontend content.js');

  if ((await Announcement.countDocuments()) === 0) {
    await Announcement.insertMany([
      {
        text: "Festival Offer — Buy 10 Get 2 Free on all ZAY'LO products!",
        link: '/products',
        position: 0,
        status: 'Active',
      },
      {
        text: 'New Launch — Try Katori & 5PM Pasta at just ₹5!',
        link: '/products',
        position: 1,
        status: 'Active',
      },
      {
        text: "Become a ZAY'LO Distributor — High margins & full support",
        link: '/dealer',
        position: 2,
        status: 'Active',
      },
    ]);
  }

  if ((await Promo.countDocuments()) === 0) {
    await Promo.insertMany([
      {
        title: 'Festival Special Offer',
        subtitle: "Celebrate with ZAY'LO — Swad Jo Dil Jeet Le",
        cta: 'Shop Now',
        link: '/products',
        gradient: 'from-emerald-500 to-teal-600',
        badge: 'Limited Time',
        slot: 'home-festival',
        variant: 'default',
        position: 0,
        status: 'Active',
      },
      {
        title: "Become a ZAY'LO Distributor",
        subtitle: 'Join 5000+ dealers across India.',
        cta: 'Apply Now',
        link: '/dealer',
        gradient: 'from-slate-800 to-emerald-800',
        badge: 'Partner With Us',
        slot: 'home-dealer',
        variant: 'dark',
        position: 1,
        status: 'Active',
      },
    ]);
  }

  if ((await Bundle.countDocuments()) === 0) {
    const bySlug = Object.fromEntries(
      (await Product.find({ slug: { $in: popularSlugs.concat(['5pm-pasta', 'salted-pipe', 'dhamal-chokdi']) } }).lean()).map(
        (p) => [p.slug, p._id],
      ),
    );
    const pick = (...slugs) => slugs.map((s) => bySlug[s]).filter(Boolean);
    await Bundle.insertMany([
      {
        name: 'Medium Box',
        tagline: 'Moon Lite, Katori, Zig Zac',
        price: 35,
        mrp: 35,
        productIds: pick('moon-lite', 'katori', 'zig-zac'),
        position: 0,
        status: 'Active',
      },
      {
        name: 'Big Pack',
        tagline: 'All popular flavours',
        price: 65,
        mrp: 65,
        productIds: pick('moon-lite', 'katori', 'zig-zac', 'noodles', '5pm-pasta', 'salted-pipe', 'dhamal-chokdi'),
        position: 1,
        status: 'Active',
      },
      {
        name: 'Small Box',
        tagline: 'Noodles, 5PM Pasta',
        price: 25,
        mrp: 25,
        productIds: pick('noodles', '5pm-pasta'),
        position: 2,
        status: 'Active',
      },
      {
        name: 'Kids Box',
        tagline: 'Moon Lite, Noodles, Salted Pipe',
        price: 35,
        mrp: 35,
        productIds: pick('moon-lite', 'noodles', 'salted-pipe'),
        position: 3,
        status: 'Active',
      },
    ]);
    logger.info('Seeded bundles');
  }

  if ((await Blog.countDocuments()) === 0) {
    await Blog.insertMany([
      {
        title: "The Secret Behind ZAY'LO's Crunch",
        excerpt: 'Discover how we maintain the perfect crunch in every bite.',
        category: 'Manufacturing',
        date: 'Oct 15, 2026',
        readTime: '4 min read',
        image:
          'https://images.unsplash.com/photo-1599490659213-e2b9527bd08c?q=80&w=800&auto=format&fit=crop',
        status: 'Published',
      },
      {
        title: '5 Creative Recipes using Moon Lite',
        excerpt: 'Turn your favorite snack into a gourmet appetizer.',
        category: 'Recipes',
        date: 'Oct 02, 2026',
        readTime: '6 min read',
        image:
          'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?q=80&w=800&auto=format&fit=crop',
        status: 'Published',
      },
    ]);
  }

  if ((await Gallery.countDocuments()) === 0) {
    await Gallery.insertMany([
      {
        url: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?q=80&w=800&auto=format&fit=crop',
        title: 'Spicy Snacks Selection',
        category: 'Products',
      },
      {
        url: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd08c?q=80&w=800&auto=format&fit=crop',
        title: 'Factory Quality Control',
        category: 'Factory',
      },
      {
        url: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=800&auto=format&fit=crop',
        title: 'Annual Dealer Meet 2026',
        category: 'Events',
      },
    ]);
  }

  logger.info('Seed complete');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
