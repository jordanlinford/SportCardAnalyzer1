export interface MarketAnalysisRequest {
  playerName: string;
  query: string;
  negKeywords?: string[];
  grade?: string;
  conditionFilter?: 'graded' | 'ungraded' | 'any';
}

export interface CardListing {
  title: string;
  price: number;
  date: string;
  imageUrl: string;
  grade?: string;
  variation?: string;
  source?: string;
  url?: string;
}

export interface MarketAnalysisResponse {
  listings: CardListing[];
  totalCount: number;
  averagePrice?: number;
  priceRange?: {
    min: number;
    max: number;
  };
  variations?: {
    name: string;
    count: number;
    averagePrice: number;
  }[];
  timeRange?: {
    start: string;
    end: string;
  };
} 