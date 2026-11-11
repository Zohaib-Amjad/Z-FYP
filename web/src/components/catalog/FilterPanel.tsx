'use client';

import { Checkbox } from '@/components/ui/Checkbox';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { enumLabel } from '@/lib/format';
import { modelOptions, type CatalogFilters } from '@/lib/catalog';
import type { VehicleFilters } from '@/types';
import { DebouncedInput } from './DebouncedInput';

interface FilterPanelProps {
  filters: CatalogFilters;
  options: VehicleFilters | undefined;
  onChange: (change: Partial<CatalogFilters>) => void;
}

const ALL = '';

interface Choice {
  value: string;
  label: string;
}

function ChoiceSelect({
  label,
  value,
  choices,
  allLabel,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  choices: Choice[];
  allLabel: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <FormField label={label}>
      {control => (
        <Select
          {...control}
          value={value}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        >
          <option value={ALL}>{allLabel}</option>
          {choices.map(choice => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </Select>
      )}
    </FormField>
  );
}

const plain = (values: string[]): Choice[] => values.map(value => ({ value, label: value }));
const labelled = (values: string[]): Choice[] =>
  values.map(value => ({ value, label: enumLabel(value) }));

export function FilterPanel({ filters, options, onChange }: FilterPanelProps) {
  const models = modelOptions(options, filters.manufacturer);

  return (
    <div className="space-y-5">
      <ChoiceSelect
        label="Manufacturer"
        value={filters.manufacturer}
        allLabel="All manufacturers"
        choices={plain(options?.manufacturers ?? [])}
        onChange={manufacturer => onChange({ manufacturer })}
      />
      <ChoiceSelect
        label="Model"
        value={filters.model}
        allLabel={filters.manufacturer ? `All ${filters.manufacturer} models` : 'All models'}
        choices={plain(models)}
        onChange={model => onChange({ model })}
        disabled={models.length === 0}
      />
      <ChoiceSelect
        label="Vehicle type"
        value={filters.vehicleType}
        allLabel="All types"
        choices={labelled(options?.vehicleTypes ?? [])}
        onChange={vehicleType =>
          onChange({ vehicleType: vehicleType as CatalogFilters['vehicleType'] })
        }
      />
      <ChoiceSelect
        label="Fuel type"
        value={filters.fuelType}
        allLabel="All fuel types"
        choices={labelled(options?.fuelTypes ?? [])}
        onChange={fuelType => onChange({ fuelType: fuelType as CatalogFilters['fuelType'] })}
      />
      <ChoiceSelect
        label="Transmission"
        value={filters.transmission}
        allLabel="All transmissions"
        choices={labelled(options?.transmissions ?? [])}
        onChange={transmission =>
          onChange({ transmission: transmission as CatalogFilters['transmission'] })
        }
      />
      <ChoiceSelect
        label="Showroom city"
        value={filters.city}
        allLabel="All showrooms"
        choices={plain(options?.cities ?? [])}
        onChange={city => onChange({ city })}
      />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-800">Year</legend>
        <div className="grid grid-cols-2 gap-3">
          <DebouncedInput
            aria-label="Earliest year"
            placeholder={options?.yearRange ? String(options.yearRange.min) : 'From'}
            inputMode="numeric"
            value={filters.minYear}
            onCommit={minYear => onChange({ minYear: minYear.replace(/\D/g, '') })}
          />
          <DebouncedInput
            aria-label="Latest year"
            placeholder={options?.yearRange ? String(options.yearRange.max) : 'To'}
            inputMode="numeric"
            value={filters.maxYear}
            onCommit={maxYear => onChange({ maxYear: maxYear.replace(/\D/g, '') })}
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink-800">Price (£)</legend>
        <div className="grid grid-cols-2 gap-3">
          <DebouncedInput
            aria-label="Minimum price"
            placeholder={options?.priceRange ? String(options.priceRange.min) : 'Min'}
            inputMode="numeric"
            value={filters.minPrice}
            onCommit={minPrice => onChange({ minPrice: minPrice.replace(/\D/g, '') })}
          />
          <DebouncedInput
            aria-label="Maximum price"
            placeholder={options?.priceRange ? String(options.priceRange.max) : 'Max'}
            inputMode="numeric"
            value={filters.maxPrice}
            onCommit={maxPrice => onChange({ maxPrice: maxPrice.replace(/\D/g, '') })}
          />
        </div>
      </fieldset>

      <Checkbox
        label="Only vehicles with available slots"
        checked={filters.availableOnly}
        onChange={event => onChange({ availableOnly: event.target.checked })}
      />
    </div>
  );
}
