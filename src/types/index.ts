export type UserRole = 'SELLER' | 'BUYER' | 'ADMIN';

export interface UserSession {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  isPhoneVerified: boolean;
  avatarUrl?: string | null;
  city?: string | null;
  address?: string | null;
}

export interface JWTPayload {
  userId: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  name: string;
}

export interface ScrapRateItem {
  id: string;
  categoryId: string;
  itemName: string;
  unit: string;
  minRate: number;
  maxRate: number;
  currentRate: number;
  priceChange?: number | null;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface ListingItem {
  id: string;
  sellerId: string;
  categoryId: string;
  title: string;
  description: string;
  quantity: number;
  unit: string;
  expectedPrice?: number | null;
  condition?: string | null;
  location: string;
  status: 'ACTIVE' | 'BIDDING' | 'SOLD' | 'CANCELLED';
  createdAt: string;
  images?: { id: string; imageUrl: string; isPrimary: boolean }[];
  seller?: { id: string; name: string; city?: string | null };
  category?: { id: string; name: string };
  _count?: { bids: number };
}

