import { useRole } from '../lib/utils/roleContext';
import { EyeOff } from 'lucide-react';

interface FieldProps {
  field: string;
  label: string;
  value: any;
  children?: React.ReactNode;
}

export function ProtectedField({ field, label, value, children }: FieldProps) {
  const { canSeeField } = useRole();

  if (!canSeeField(field)) {
    return (
      <div>
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-sm text-gray-400 flex items-center gap-1">
          <EyeOff className="w-3 h-3" />
          <span className="italic">Hidden - Insufficient permissions</span>
        </div>
      </div>
    );
  }

  if (children) {
    return <>{children}</>;
  }

  return (
    <div>
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

interface MetadataProps {
  metadata: Record<string, any>;
  fieldMapping?: Record<string, string>;
}

export function ProtectedMetadata({ metadata, fieldMapping = {} }: MetadataProps) {
  const { canSeeField, currentRole } = useRole();

  // Define which metadata fields require which permissions
  const defaultMapping: Record<string, string> = {
    description: 'basic',
    dimensions: 'basic',
    width: 'basic',
    height: 'basic',
    unit: 'basic',
    weight: 'materials',
    thickness: 'materials',
    uValue: 'operations',
    material: 'materials',
    finish: 'manufacturing',
    productionDate: 'operations',
    batch: 'manufacturing',
    ...fieldMapping,
  };

  // Filter out image_url from metadata display
  const filteredMetadata = Object.entries(metadata).filter(([key]) => key !== 'image_url');

  return (
    <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">Metadata</div>
        <div className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
          Viewing as: {currentRole}
        </div>
      </div>
      <div className="text-sm text-gray-900 dark:text-white space-y-1">
        {filteredMetadata.map(([key, value]) => {
          const requiredPermission = defaultMapping[key] || 'basic';
          const hasPermission = canSeeField(requiredPermission);

          // Format dimensions nicely
          let displayValue: string;
          if (typeof value === 'object' && value !== null) {
            if (key === 'dimensions' && 'width' in value && 'height' in value) {
              const unit = (value as any).unit || 'mm';
              displayValue = `${(value as any).width} ${unit} x ${(value as any).height} ${unit}`;
            } else if ('width' in value && 'height' in value && 'unit' in value) {
              displayValue = `${(value as any).width} ${(value as any).unit} x ${(value as any).height} ${(value as any).unit}`;
            } else {
              displayValue = JSON.stringify(value);
            }
          } else {
            displayValue = String(value);
          }

          return (
            <div key={key} className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">{key}:</span>
              {hasPermission ? (
                <span className="font-medium text-gray-900 dark:text-white">
                  {displayValue}
                </span>
              ) : (
                <span className="text-gray-400 flex items-center gap-1 italic">
                  <EyeOff className="w-3 h-3" />
                  Hidden
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
