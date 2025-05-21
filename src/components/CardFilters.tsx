import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useState } from "react";

export interface CardFilters {
  search: string;
  year?: string;
  condition?: string;
  minValue?: number;
  maxValue?: number;
  sortBy: "playerName" | "year" | "currentValue" | "pricePaid" | "condition";
  sortOrder: "asc" | "desc";
}

interface CardFiltersProps {
  filters: CardFilters;
  onFilterChange: (filters: CardFilters) => void;
}

const defaultFilters: CardFilters = {
  search: "",
  sortBy: "playerName",
  sortOrder: "asc",
};

export function CardFilters({ filters, onFilterChange }: CardFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onFilterChange({
      ...filters,
      [name]: value,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label htmlFor="search" className="text-sm font-medium block mb-2">
            Search Cards
          </label>
          <Input
            id="search"
            name="search"
            placeholder="Search by player name, set, or number..."
            value={filters.search}
            onChange={handleInputChange}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Less Filters" : "More Filters"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onFilterChange(defaultFilters)}
          >
            Reset
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div>
            <label htmlFor="year" className="text-sm font-medium block mb-2">
              Year
            </label>
            <Input
              id="year"
              name="year"
              placeholder="Filter by year..."
              value={filters.year || ""}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label htmlFor="condition" className="text-sm font-medium block mb-2">
              Condition
            </label>
            <Input
              id="condition"
              name="condition"
              placeholder="Filter by condition..."
              value={filters.condition || ""}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label htmlFor="sortBy" className="text-sm font-medium block mb-2">
              Sort By
            </label>
            <div className="flex gap-2">
              <select
                id="sortBy"
                name="sortBy"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={filters.sortBy}
                onChange={handleInputChange}
              >
                <option value="playerName">Player Name</option>
                <option value="year">Year</option>
                <option value="currentValue">Current Value</option>
                <option value="pricePaid">Price Paid</option>
                <option value="condition">Condition</option>
              </select>
              <select
                id="sortOrder"
                name="sortOrder"
                aria-label="Sort order"
                className="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                value={filters.sortOrder}
                onChange={handleInputChange}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="minValue" className="text-sm font-medium block mb-2">
              Min Value
            </label>
            <Input
              id="minValue"
              name="minValue"
              type="number"
              placeholder="Min value..."
              value={filters.minValue || ""}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <label htmlFor="maxValue" className="text-sm font-medium block mb-2">
              Max Value
            </label>
            <Input
              id="maxValue"
              name="maxValue"
              type="number"
              placeholder="Max value..."
              value={filters.maxValue || ""}
              onChange={handleInputChange}
            />
          </div>
        </div>
      )}
    </div>
  );
} 