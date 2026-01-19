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

// Helper function to format key names into human-readable labels
function formatKeyToLabel(key: string): string {
  // Convert camelCase/snake_case to Title Case with spaces
  return key
    .replace(/([A-Z])/g, ' $1') // Add space before capitals
    .replace(/_/g, ' ') // Replace underscores with spaces
    .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
    .trim();
}

// Helper function to format values in a human-readable way
function formatValueForDisplay(key: string, value: any): string {
  if (value === null || value === undefined) return 'N/A';
  
  // Handle boolean values
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    if (typeof value[0] === 'object') {
      return value.map((item, i) => `Item ${i + 1}`).join(', ');
    }
    return value.join(', ');
  }
  
  // Handle nested objects - format them nicely
  if (typeof value === 'object') {
    // Special handling for dimensions
    if ('width' in value && 'height' in value) {
      const unit = (value as any).unit || 'mm';
      const depth = (value as any).depth;
      if (depth) {
        return `${value.width} × ${value.height} × ${depth} ${unit}`;
      }
      return `${value.width} × ${value.height} ${unit}`;
    }
    
    // Special handling for glass/frame metadata
    if (key === 'glass' || key === 'frame') {
      const parts: string[] = [];
      Object.entries(value).forEach(([k, v]) => {
        if (v !== null && v !== undefined && k !== 'type') {
          parts.push(`${formatKeyToLabel(k)}: ${formatValueForDisplay(k, v)}`);
        }
      });
      return parts.join(' • ') || 'Standard configuration';
    }
    
    // Special handling for components array in metadata
    if (key === 'components' && Array.isArray(value)) {
      return `${value.length} component(s)`;
    }
    
    // Generic object formatting - show key: value pairs
    const parts: string[] = [];
    Object.entries(value).forEach(([k, v]) => {
      if (v !== null && v !== undefined) {
        const formattedValue = typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
        parts.push(`${formatKeyToLabel(k)}: ${formattedValue}`);
      }
    });
    return parts.join(' • ') || 'No details';
  }
  
  // Handle number values - add units where appropriate
  if (typeof value === 'number') {
    const keyLower = key.toLowerCase();
    if (keyLower.includes('weight')) return `${value} kg`;
    if (keyLower.includes('thickness')) return `${value} mm`;
    if (keyLower.includes('u_value') || keyLower.includes('uvalue')) return `${value} W/m²K`;
    if (keyLower.includes('co2') || keyLower.includes('carbon')) return `${value} kg CO₂e`;
    if (keyLower.includes('percent') || keyLower.includes('recycl') || keyLower.includes('rating')) return `${value}%`;
    return String(value);
  }
  
  // String values - handle some special cases
  if (typeof value === 'string') {
    // Capitalize first letter for display
    if (value.length > 0 && value.length < 50) {
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    return value;
  }
  
  return String(value);
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

          // Format value in human-readable way
          const displayValue = formatValueForDisplay(key, value);

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
