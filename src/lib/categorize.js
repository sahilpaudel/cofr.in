const RULES = [
  {
    category: 'Food & Dining',
    keywords: [
      'swiggy', 'zomato', 'dunzo', 'blinkit', 'zepto', 'dominos', "domino's", 'pizza hut',
      'kfc', 'mcdonalds', "mcdonald's", 'burger king', 'subway', 'cafe coffee day', 'starbucks',
      'restaurant', 'cafe ', 'dhaba', 'biryani', 'food', 'canteen', 'mess ', 'bakery',
    ],
  },
  {
    category: 'Transport',
    keywords: [
      'uber', 'ola ', 'rapido', 'metro ', 'irctc', 'petrol', 'fuel', 'diesel', 'parking',
      'toll ', 'cab ', 'taxi', 'namma yatri', 'blu smart', 'bus ', 'auto ',
    ],
  },
  {
    category: 'Shopping',
    keywords: [
      'amazon', 'flipkart', 'myntra', 'ajio', 'nykaa', 'meesho', 'snapdeal',
      'shoppers stop', 'pantaloons', 'lifestyle ', 'reliance retail', 'trends', 'westside',
      'bigbasket', 'grofers', 'dmart', 'jiomart', 'tata cliq',
    ],
  },
  {
    category: 'Entertainment',
    keywords: [
      'netflix', 'prime video', 'hotstar', 'disney', 'sony liv', 'sonyliv', 'zee5',
      'spotify', 'gaana', 'youtube', 'bookmyshow', 'pvr ', 'inox ', 'cinepolis',
      'gaming', 'steam', 'epic games', 'playstation',
    ],
  },
  {
    category: 'Utilities',
    keywords: [
      'electricity', 'bescom', 'tata power', 'adani electricity', 'msedcl', 'kseb',
      'water bill', 'gas bill', 'broadband', 'airtel', 'jio ', 'vi ', 'vodafone',
      'bsnl', 'dth', 'tata sky', 'dish tv', 'sun direct', 'recharge', 'postpaid',
    ],
  },
  {
    category: 'Healthcare',
    keywords: [
      'hospital', 'clinic', 'pharmacy', 'medical', 'doctor', 'apollo', 'medplus',
      'practo', 'cult fit', 'cure fit', 'insurance', 'star health', 'hdfc ergo',
      'bajaj allianz', 'max bupa', 'diagnostic',
    ],
  },
  {
    category: 'Travel',
    keywords: [
      'makemytrip', 'goibibo', 'yatra', 'cleartrip', 'airline', 'air india', 'indigo',
      'spicejet', 'vistara', 'akasa', 'oyo', 'booking.com', 'airbnb', 'resort', 'klook',
      'hotel', 'holidify', 'thomascook', 'ease my trip',
    ],
  },
  {
    category: 'Investments',
    keywords: [
      'mutual fund', ' sip', 'zerodha', 'groww', 'kuvera', 'smallcase', 'coin ',
      'nse ', 'bse ', 'ipo ', 'nps ', 'ppf ', 'epf ', 'sukanya', 'fd booking', ' rd ',
      'gilt', 'bond ', 'demat',
    ],
  },
  {
    category: 'Transfers',
    keywords: [
      'upi/', 'upi/', 'upi/p2a', 'upi transfer', 'upi to ',
      'neft/', 'neft transfer', 'neft to',
      'rtgs/', 'rtgs transfer',
      'imps/', 'imps to ',
      'transfer to', 'transfer-', 'sent to', 'payment to', 'p2p',
      'phonepe', 'gpay', 'paytm', 'bhim', 'cc payment', 'bppy', 'payment received',
    ],
  },
  {
    category: 'Income',
    keywords: [
      'salary', 'income', 'dividend', 'interest credit', 'interest cr',
      'cashback', 'refund', 'reward', 'incentive', 'bonus',
      'credit by', 'neft cr', 'imps cr', 'transfer from', 'neft from', 'imps from',
    ],
  },
];

export const ALL_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Utilities', 'Healthcare', 'Travel', 'Investments', 'Transfers', 'Income', 'Other',
];

export const CATEGORY_COLORS = {
  'Food & Dining':  '#f97316',
  'Transport':      '#3b82f6',
  'Shopping':       '#a855f7',
  'Entertainment':  '#ec4899',
  'Utilities':      '#14b8a6',
  'Healthcare':     '#10b981',
  'Travel':         '#f59e0b',
  'Investments':    '#6366f1',
  'Transfers':      '#64748b',
  'Income':         '#22c55e',
  'Other':          '#94a3b8',
};

export function categorize(description) {
  const lower = description.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some(k => lower.includes(k))) return rule.category;
  }
  return 'Other';
}
