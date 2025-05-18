import { useState, useMemo } from "react";
import { Card as CardType } from "../types/Card";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { EmergencyDeleteButton } from "@/components/EmergencyDeleteButton";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ExternalLink, ArrowUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type SortField = 'createdAt' | 'playerName' | 'value' | 'year';
type SortOrder = 'asc' | 'desc';

interface CollectionTableProps {
  onEditCard?: (card: CardType) => void;
  onUpdateCard?: (card: CardType) => Promise<void>;
  cards: CardType[]; // Required cards prop from parent
  updatingCardIds?: string[];
}

export default function CollectionTable({ onEditCard, cards, onUpdateCard, updatingCardIds = [] }: CollectionTableProps) {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const queryClient = useQueryClient();

  // Get unique tags from all cards
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    cards.forEach(card => {
      card.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [cards]);

  // Filter and sort cards
  const filteredAndSortedCards = useMemo(() => {
    let filtered = cards;
    
    // Apply tag filter
    if (selectedTag) {
      filtered = filtered.filter(card => 
        card.tags?.includes(selectedTag)
      );
    }

    // Apply sorting
    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'createdAt':
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'playerName':
          comparison = (a.playerName || '').localeCompare(b.playerName || '');
          break;
        case 'value':
          comparison = (a.currentValue || a.price || 0) - (b.currentValue || b.price || 0);
          break;
        case 'year': {
          const yearA = Number(a.year) || 0;
          const yearB = Number(b.year) || 0;
          comparison = yearA - yearB;
          break;
        }
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [cards, selectedTag, sortField, sortOrder]);

  // Calculate pagination
  const paginatedCards = filteredAndSortedCards.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filteredAndSortedCards.length / pageSize);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setPage(1); // Reset to first page when sorting changes
  };

  const handleCardDeleted = () => {
    // Refetch cards after deletion
    queryClient.invalidateQueries({ queryKey: ["cards"] });
  };

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No cards in your collection yet. Add some cards to get started!
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label htmlFor="tag-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Tag
            </label>
            <div className="flex items-center gap-2">
              <select
                id="tag-filter"
                value={selectedTag}
                onChange={(e) => {
                  setSelectedTag(e.target.value);
                  setPage(1); // Reset to first page when filter changes
                }}
                className="rounded-md border-gray-300 text-sm"
              >
                <option value="">All Tags</option>
                {availableTags.map(tag => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              {selectedTag && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTag('');
                    setPage(1);
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-end">
            <select
              value={pageSize}
              aria-label="Select number of cards per page"
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-md border-gray-300 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('playerName')}>
                <div className="flex items-center gap-1">
                  Player
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" onClick={() => handleSort('year')}>
                <div className="flex items-center gap-1">
                  Year
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Set
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Variation
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Condition
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('value')}>
                <div className="flex items-center gap-1">
                  Value
                  <ArrowUpDown className="h-4 w-4" />
                </div>
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tags
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedCards.map((card) => (
              <tr key={card.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {card.playerName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {card.year}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {card.cardSet}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {card.variation}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {card.condition}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  ${((card.currentValue || card.price || 0).toFixed(2))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {card.tags && card.tags.length > 0 ? card.tags.join(', ') : '—'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-2">
                    {onUpdateCard && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCard(card);
                        }}
                        disabled={updatingCardIds.includes(card.id)}
                      >
                        {updatingCardIds.includes(card.id) ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Check on eBay"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Create a full search string for eBay
                        const searchQuery = `${card.year} ${card.playerName} ${card.cardSet} ${card.variation || ''} ${card.cardNumber} ${card.condition || ''}`;
                        // Open eBay search in a new tab
                        window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0&LH_Complete=1&LH_Sold=1`, '_blank');
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <button
                      onClick={() => onEditCard?.(card)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <EmergencyDeleteButton
                      cardId={card.id}
                      onDeleted={handleCardDeleted}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex items-center gap-4">
            <select
              value={pageSize}
              aria-label="Select number of cards per page"
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1); // Reset to first page when changing page size
              }}
              className="rounded-md border-gray-300 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{" "}
                <span className="font-medium">{Math.min(page * pageSize, cards.length)}</span> of{" "}
                <span className="font-medium">{cards.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pageNum
                        ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                        : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 