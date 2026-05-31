import { useTranslation } from "react-i18next";
import { useFilterStore, type SignalFilterType } from "@/store/filter-store";
import { ASSET_TYPE_OPTIONS } from "@/constants/assets";
import { SIGNAL_FILTER_OPTIONS } from "@/constants/signals";
import { FilterGroup } from "@/components/shared/filter-group";
import { Separator } from "@/components/ui/separator";
import type { AssetFilterType } from "@/types/asset";

export function FilterBar() {
  const { t } = useTranslation();
  const { assetType, setAssetType, signalFilter, setSignalFilter } =
    useFilterStore();

  const translatedAssetOptions = ASSET_TYPE_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`common.asset_types.${opt.value}`),
  }));

  const translatedSignalOptions = SIGNAL_FILTER_OPTIONS.map((opt) => ({
    ...opt,
    label: t(`common.signals.${opt.value}`),
  }));

  return (
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <FilterGroup
        value={assetType}
        options={translatedAssetOptions}
        onChange={(v) => setAssetType(v as AssetFilterType)}
        className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
      />

      <Separator orientation="vertical" className="mx-1" />

      <FilterGroup
        value={signalFilter}
        options={translatedSignalOptions}
        onChange={(v) => setSignalFilter(v as SignalFilterType)}
        className="flex-1 md:flex-none shrink-0 min-w-0 sm:w-fit"
      />
    </div>
  );
}
