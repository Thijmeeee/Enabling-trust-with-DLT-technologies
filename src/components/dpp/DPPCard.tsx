import { Package, ExternalLink, ChevronRight, Settings } from 'lucide-react';
import type { DPP } from '../../lib/data/localData';
import { getSchemaForType } from '../../lib/schemas/productSchema';
import { useRole } from '../../lib/utils/roleContext';
import { LifecycleStatusBadge } from '../shared/LifecycleStatusBadge';

type DPPCardProps = {
  dpp: DPP;
  onClick: () => void;
  onManage?: (e: React.MouseEvent) => void;
  viewMode: 'grid' | 'list';
};

// ... (keep permission mapping)
// Map metadata fields to permission requirements
const fieldPermissions: Record<string, string> = {
  batch: 'operations',
  productionDate: 'operations',
  custodian: 'operations',
  // Add more field mappings as needed
};

export function DPPCard({ dpp, onClick, onManage, viewMode }: DPPCardProps) {
  const { canSeeField } = useRole();
  const canManage = onManage && canSeeField('lifecycle');

  // Try to get product type from metadata, or fallback to fuzzy matching from model name
  const rawProductType = dpp.metadata.productType as string || '';
  // ... (keep existing logic)
  let schema = getSchemaForType(rawProductType);

  // If no schema found by productType, try to infer from model name
  if (!schema && dpp.model) {
    schema = getSchemaForType(dpp.model);
  }

  const productType = schema?.id || rawProductType || 'unknown';
  const color = schema?.color || '#3B82F6';
  const isMain = dpp.type === 'main';

  // ... (keep fields logic)
  // Get primary fields from schema and filter based on permissions
  const allPrimaryFields = schema?.ui?.listView?.primaryFields || ['model'];
  const allSecondaryFields = schema?.ui?.listView?.secondaryFields || [];

  // Filter fields based on role permissions
  const primaryFields = allPrimaryFields.filter(field => {
    const requiredPermission = fieldPermissions[field];
    return !requiredPermission || canSeeField(requiredPermission);
  });

  const secondaryFields = allSecondaryFields.filter(field => {
    const requiredPermission = fieldPermissions[field];
    return !requiredPermission || canSeeField(requiredPermission);
  });

  const renderField = (key: string) => {
    const value = key === 'model' ? dpp.model : dpp.metadata[key];
    if (!value) return null;

    const propDef = schema?.properties.find(p => p.key === key);
    const label = propDef?.label || (key === 'model' ? 'Model' : key);

    let displayValue: string = '';
    if (typeof value === 'object' && value !== null) {
      if ('width' in value && 'height' in value) {
        displayValue = `${(value as any).width}mm x ${(value as any).height}mm`;
      } else {
        displayValue = JSON.stringify(value);
      }
    } else {
      displayValue = String(value);
    }

    return (
      <div key={key} className="text-sm">
        <span className="text-gray-500 dark:text-gray-400">{label}:</span>{' '}
        <span className="font-medium text-gray-900 dark:text-white">{displayValue}</span>
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div className="relative group">
        <button
          onClick={(e) => {
            console.log('DPPCard (list) clicked:', dpp.did, 'type:', dpp.type);
            e.stopPropagation();
            onClick();
          }}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg p-4 transition-all hover:shadow-md text-left flex items-center gap-4"
        >
          {/* Icon */}
          <div
            className="p-3 rounded-lg flex-shrink-0"
            style={{ backgroundColor: `${color}20` }}
          >
            <Package className="w-6 h-6" style={{ color }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">{dpp.model}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{dpp.did}</p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isMain && (
                  <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold rounded-full">
                    MAIN
                  </span>
                )}
                <span
                  className="px-2 py-1 text-xs font-semibold rounded-full"
                  style={{
                    backgroundColor: `${color}20`,
                    color: color
                  }}
                >
                  {schema?.name || productType}
                </span>
                <LifecycleStatusBadge status={dpp.lifecycle_status} size="sm" />
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              {primaryFields.map(renderField)}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        </button>
        {canManage && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManage(e);
            }}
            className="absolute right-14 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Manage Lifecycle"
          >
            <Settings className="w-5 h-5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => {
        console.log('DPPCard clicked:', dpp.did, 'type:', dpp.type);
        e.stopPropagation();
        onClick();
      }}
      className="w-full h-full bg-white dark:bg-gray-800 border-2 hover:border-gray-300 dark:hover:border-gray-600 rounded-lg p-5 transition-all hover:shadow-lg text-left group flex flex-col relative"
      style={{ borderColor: isMain ? color : undefined }}
    >
      {canManage && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onManage(e);
          }}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Manage Lifecycle"
        >
          <Settings className="w-5 h-5" />
        </div>
      )}

      <div className="flex-1 flex flex-col w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div
            className="p-3 rounded-lg group-hover:scale-110 transition-transform"
            style={{ backgroundColor: `${color}20` }}
          >
            <Package className="w-7 h-7" style={{ color }} />
          </div>

          <div className="flex flex-col items-end gap-1 mr-8">
            {isMain && (
              <span className="px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-full shadow-sm">
                MAIN PRODUCT
              </span>
            )}
            <span
              className="px-3 py-1 text-xs font-semibold rounded-full"
              style={{
                backgroundColor: `${color}20`,
                color: color
              }}
            >
              {schema?.name || productType}
            </span>
          </div>
        </div>

        {/* Title */}
        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {dpp.model}
        </h3>

        {/* DID */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2 mb-3 border border-gray-200 dark:border-gray-600 transition-colors shrink-0">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">DID</p>
          <p className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all leading-relaxed line-clamp-2">{dpp.did}</p>
        </div>

        {/* Primary Fields */}
        <div className="space-y-2 mb-4">
          {primaryFields.map(renderField)}
        </div>

        {/* Secondary Fields */}
        {secondaryFields.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 mt-auto">
            {secondaryFields.map(key => {
              const value = dpp.metadata[key];
              if (!value) return null;

              const propDef = schema?.properties.find(p => p.key === key);
              let display = String(value);
              if (propDef?.unit) {
                display += ` ${propDef.unit}`;
              }

              return (
                <span key={key} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded transition-colors font-medium">
                  {display}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto w-full shrink-0">
        <div className="flex items-center gap-2">
          <LifecycleStatusBadge status={dpp.lifecycle_status} />
        </div>

        <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 group-hover:gap-2 transition-all">
          <span className="text-sm font-medium">Details</span>
          <ExternalLink className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
