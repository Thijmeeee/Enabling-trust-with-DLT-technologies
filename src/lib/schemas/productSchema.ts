/**
 * Product Type Schema System
 * Defines structure, components, properties and credentials for any product type
 */

export type PropertyDefinition = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required?: boolean;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
  unit?: string;
  description?: string;
};

export type ComponentDefinition = {
  type: string;
  label: string;
  minQuantity: number;
  maxQuantity: number;
  required: boolean;
  position?: number;
  allowedTypes?: string[]; // Restrict which product types can be used
};

export type CredentialDefinition = {
  type: string;
  label: string;
  issuerTypes: string[]; // Which organizations can issue this
  required: boolean;
  expiryDays?: number;
  properties: PropertyDefinition[];
};

export type ProductTypeSchema = {
  id: string;
  name: string;
  category: 'main' | 'component' | 'material';
  version: string;
  description: string;
  icon?: string;
  color: string; // For UI differentiation
  
  // Properties specific to this product type
  properties: PropertyDefinition[];
  
  // What components can/must this product have
  componentSlots: ComponentDefinition[];
  
  // What credentials are relevant for this product
  credentials: CredentialDefinition[];
  
  // Lifecycle stages specific to this product
  lifecycleStages: string[];
  
  // Validation rules
  validation?: {
    customRules?: string[]; // Names of validation functions
  };
  
  // UI configuration
  ui?: {
    listView?: {
      primaryFields: string[];
      secondaryFields: string[];
    };
    detailView?: {
      sections: {
        title: string;
        fields: string[];
      }[];
    };
  };
};

/**
 * Built-in product schemas
 */
export const PRODUCT_SCHEMAS: Record<string, ProductTypeSchema> = {
  window: {
    id: 'window',
    name: 'Window',
    category: 'main',
    version: '1.0.0',
    description: 'Complete window assembly with frame and glazing',
    color: '#1E40AF',
    
    properties: [
      {
        key: 'dimensions',
        label: 'Dimensions',
        type: 'object',
        required: true,
        description: 'Width and height in mm',
      },
      {
        key: 'weight',
        label: 'Weight (kg)',
        type: 'number',
        required: true,
        unit: 'kg',
      },
      {
        key: 'productionDate',
        label: 'Production Date',
        type: 'date',
        required: true,
      },
      {
        key: 'batch',
        label: 'Batch Number',
        type: 'string',
        required: false,
      },
    ],
    
    componentSlots: [
      {
        type: 'glazing',
        label: 'Glazing Unit',
        minQuantity: 1,
        maxQuantity: 1,
        required: true,
        allowedTypes: ['glass', 'glazing-unit'],
      },
      {
        type: 'frame',
        label: 'Frame',
        minQuantity: 1,
        maxQuantity: 1,
        required: true,
        allowedTypes: ['frame'],
      },
      {
        type: 'hardware',
        label: 'Hardware',
        minQuantity: 0,
        maxQuantity: 10,
        required: false,
        allowedTypes: ['handle', 'hinge', 'lock'],
      },
    ],
    
    credentials: [
      {
        type: 'QualityCertificate',
        label: 'Quality Certificate',
        issuerTypes: ['certification-body'],
        required: true,
        expiryDays: 1825, // 5 years
        properties: [
          { key: 'certificateNumber', label: 'Certificate Number', type: 'string', required: true },
          { key: 'testResults', label: 'Test Results', type: 'object', required: true },
        ],
      },
      {
        type: 'SustainabilityCredential',
        label: 'Sustainability Assessment',
        issuerTypes: ['environmental-assessor'],
        required: false,
        properties: [
          { key: 'carbonFootprint', label: 'Carbon Footprint', type: 'object', required: true },
          { key: 'recycledContent', label: 'Recycled Content %', type: 'number', required: true },
        ],
      },
    ],
    
    lifecycleStages: ['manufacturing', 'assembly', 'quality-check', 'installation', 'maintenance', 'end-of-life'],
    
    ui: {
      listView: {
        primaryFields: ['model', 'dimensions', 'productionDate'],
        secondaryFields: ['batch', 'weight'],
      },
    },
  },
  
  glass: {
    id: 'glass',
    name: 'Glass Panel',
    category: 'component',
    version: '1.0.0',
    description: 'Glass panel for glazing',
    color: '#7DD3FC',
    
    properties: [
      {
        key: 'thickness',
        label: 'Thickness (mm)',
        type: 'number',
        required: true,
        unit: 'mm',
      },
      {
        key: 'uValue',
        label: 'U-Value',
        type: 'number',
        required: true,
        unit: 'W/m²K',
      },
      {
        key: 'coating',
        label: 'Coating Type',
        type: 'string',
        required: false,
        validation: {
          enum: ['Low-E', 'Reflective', 'Tinted', 'Clear'],
        },
      },
      {
        key: 'productionDate',
        label: 'Production Date',
        type: 'date',
        required: true,
      },
    ],
    
    componentSlots: [],
    
    credentials: [
      {
        type: 'ThermalPerformanceCertificate',
        label: 'Thermal Performance',
        issuerTypes: ['testing-lab'],
        required: true,
        properties: [
          { key: 'uValue', label: 'U-Value', type: 'number', required: true },
          { key: 'solarHeatGainCoefficient', label: 'SHGC', type: 'number', required: true },
        ],
      },
    ],
    
    lifecycleStages: ['manufacturing', 'quality-check', 'transport', 'installation'],
    
    ui: {
      listView: {
        primaryFields: ['model', 'thickness', 'uValue'],
        secondaryFields: ['coating', 'productionDate'],
      },
    },
  },
  
  frame: {
    id: 'frame',
    name: 'Window Frame',
    category: 'component',
    version: '1.0.0',
    description: 'Frame structure for window',
    color: '#8B5CF6',
    
    properties: [
      {
        key: 'material',
        label: 'Material',
        type: 'string',
        required: true,
        validation: {
          enum: ['Aluminum', 'UPVC', 'Wood', 'Composite'],
        },
      },
      {
        key: 'finish',
        label: 'Surface Finish',
        type: 'string',
        required: true,
      },
      {
        key: 'thermalBreak',
        label: 'Thermal Break',
        type: 'boolean',
        required: true,
      },
      {
        key: 'productionDate',
        label: 'Production Date',
        type: 'date',
        required: true,
      },
    ],
    
    componentSlots: [],
    
    credentials: [
      {
        type: 'StructuralCertificate',
        label: 'Structural Integrity',
        issuerTypes: ['testing-lab'],
        required: true,
        properties: [
          { key: 'loadCapacity', label: 'Load Capacity', type: 'number', required: true },
          { key: 'windResistance', label: 'Wind Resistance', type: 'string', required: true },
        ],
      },
    ],
    
    lifecycleStages: ['manufacturing', 'quality-check', 'transport', 'installation'],
    
    ui: {
      listView: {
        primaryFields: ['model', 'material', 'thermalBreak'],
        secondaryFields: ['finish', 'productionDate'],
      },
    },
  },
};

/**
 * Validate a DPP against its product schema
 */
export function validateAgainstSchema(
  dpp: any,
  schema: ProductTypeSchema
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate required properties
  for (const prop of schema.properties.filter(p => p.required)) {
    if (!(prop.key in dpp.metadata)) {
      errors.push(`Missing required property: ${prop.label}`);
    }
  }
  
  // Validate property types and constraints
  for (const prop of schema.properties) {
    const value = dpp.metadata[prop.key];
    if (value === undefined || value === null) continue;
    
    // Type validation
    const actualType = typeof value;
    if (prop.type === 'number' && actualType !== 'number') {
      errors.push(`${prop.label} must be a number`);
    }
    
    // Range validation
    if (prop.validation) {
      if (prop.validation.min !== undefined && value < prop.validation.min) {
        errors.push(`${prop.label} must be at least ${prop.validation.min}`);
      }
      if (prop.validation.max !== undefined && value > prop.validation.max) {
        errors.push(`${prop.label} must be at most ${prop.validation.max}`);
      }
      if (prop.validation.enum && !prop.validation.enum.includes(value)) {
        errors.push(`${prop.label} must be one of: ${prop.validation.enum.join(', ')}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get schema for a product type
 */
export function getSchemaForType(productType: string): ProductTypeSchema | null {
  return PRODUCT_SCHEMAS[productType] || null;
}

/**
 * Register a new product schema dynamically
 */
export function registerProductSchema(schema: ProductTypeSchema): void {
  PRODUCT_SCHEMAS[schema.id] = schema;
}
