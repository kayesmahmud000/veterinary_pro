import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/ui/cn";
import { getLocalization } from "@/lib/i18n/server";

export function PublicFilters({
  action,
  query,
  queryLabel,
  placeholder,
  filterName,
  filterValue,
  filterLabel,
  allLabel,
  options,
}: {
  action: string;
  query: string;
  queryLabel: string;
  placeholder: string;
  filterName: string;
  filterValue: string;
  filterLabel: string;
  allLabel: string;
  options: readonly { value: string; label: string }[];
}) {
  const { messages } = getLocalization();
  const t = messages.publicPages;
  return (
    <form
      key={`${query}:${filterName}:${filterValue}`}
      action={action}
      method="get"
      className="mb-8 grid items-end gap-4 rounded-2xl border border-solid border-line bg-white p-5 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.6fr)_auto]"
    >
      <div>
        <label
          htmlFor="public-search"
          className="mb-2 block text-sm font-semibold"
        >
          {queryLabel}
        </label>
        <Input
          id="public-search"
          type="search"
          name="q"
          defaultValue={query}
          placeholder={placeholder}
          maxLength={200}
        />
      </div>
      <div>
        <label
          htmlFor="public-filter"
          className="mb-2 block text-sm font-semibold"
        >
          {filterLabel}
        </label>
        <select
          id="public-filter"
          name={filterName}
          defaultValue={filterValue}
          className="min-h-11 w-full rounded-lg border border-solid border-line bg-white px-3 py-2 text-base text-ink"
        >
          <option value="">{allLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <Search size={16} aria-hidden="true" />
          {t.apply}
        </Button>
        <a href={action} className={cn(buttonVariants({ variant: "outline" }))}>
          {t.reset}
        </a>
      </div>
    </form>
  );
}
