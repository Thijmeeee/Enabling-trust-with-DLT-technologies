/**
 * Declaration of Performance (DoP) Schema
 * Based on EU Construction Products Regulation (CPR) 305/2011
 */

export interface PerformanceCharacteristic {
  characteristic: string;
  performance: string;
  harmonizedStandard: string;
  classification?: string;
  unit?: string;
  testMethod?: string;
}

export interface DeclarationOfPerformance {
  dopNumber: string;
  issueDate: string;
  manufacturer: {
    name: string;
    address: string;
    contactInfo: string;
  };
  productType: string;
  productIdentification: {
    productCode: string;
    batchNumber?: string;
    serialNumber?: string;
  };
  intendedUse: string;
  harmonizedStandard: string;
  notifiedBody?: {
    name: string;
    number: string;
    certification?: string;
  };
  declaredPerformance: PerformanceCharacteristic[];
  ceMarking: {
    issued: boolean;
    year: number;
  };
  signature: {
    signedBy: string;
    position: string;
    date: string;
  };
}

/**
 * Generate DoP for Window products
 */
export function generateWindowDoP(product: {
  model: string;
  owner: string;
  metadata: any;
  created_at: string;
}): DeclarationOfPerformance {
  const batchNumber = product.metadata?.batch || 'B2024-001';
  const width = product.metadata?.dimensions?.width || 1200;
  const height = product.metadata?.dimensions?.height || 1400;
  
  return {
    dopNumber: `DoP-WIN-${Date.now().toString().slice(-8)}`,
    issueDate: new Date(product.created_at).toISOString().split('T')[0],
    manufacturer: {
      name: 'Advanced Window Systems B.V.',
      address: '123 Industry Street, 1234 AB Amsterdam, Netherlands',
      contactInfo: 'info@advancedwindows.nl | +31 20 1234567',
    },
    productType: 'Aluminium-frame insulated window with double glazing',
    productIdentification: {
      productCode: product.model,
      batchNumber: batchNumber,
      serialNumber: `${batchNumber}-${Math.floor(Math.random() * 10000)}`,
    },
    intendedUse: 'External window for residential and commercial buildings',
    harmonizedStandard: 'EN 14351-1:2006+A2:2016',
    notifiedBody: {
      name: 'European Testing Institute',
      number: '0123',
      certification: 'System 3',
    },
    declaredPerformance: [
      {
        characteristic: 'Fire Resistance',
        performance: 'E 30',
        harmonizedStandard: 'EN 13501-2',
        classification: 'Class E',
        testMethod: 'EN 1634-1',
      },
      {
        characteristic: 'Thermal Transmittance (U-value)',
        performance: '1.2',
        unit: 'W/(m²·K)',
        harmonizedStandard: 'EN ISO 10077-1',
        testMethod: 'EN 12412-2',
      },
      {
        characteristic: 'Sound Reduction Index',
        performance: '34',
        unit: 'dB (Rw)',
        harmonizedStandard: 'EN ISO 717-1',
        classification: 'Class 3',
        testMethod: 'EN ISO 10140-2',
      },
      {
        characteristic: 'Water Tightness',
        performance: '9A',
        harmonizedStandard: 'EN 12208',
        classification: 'Class 9A',
        testMethod: 'EN 1027',
      },
      {
        characteristic: 'Air Permeability',
        performance: '4',
        unit: 'm³/(h·m²) at 100 Pa',
        harmonizedStandard: 'EN 12207',
        classification: 'Class 4',
        testMethod: 'EN 1026',
      },
      {
        characteristic: 'Wind Load Resistance',
        performance: 'C4',
        harmonizedStandard: 'EN 12210',
        classification: 'Class C4',
        testMethod: 'EN 12211',
      },
      {
        characteristic: 'Operating Force',
        performance: '< 65 N',
        unit: 'N (Newton)',
        harmonizedStandard: 'EN 13115',
        testMethod: 'EN 12046-2',
      },
      {
        characteristic: 'Mechanical Strength',
        performance: 'Passed',
        harmonizedStandard: 'EN 14351-1',
        testMethod: 'EN 107, EN 948, EN 949',
      },
      {
        characteristic: 'Load-bearing Capacity',
        performance: `${Math.floor((width * height) / 1000)} kg`,
        harmonizedStandard: 'EN 14351-1',
      },
      {
        characteristic: 'Resistance to Repeated Opening/Closing',
        performance: '20,000 cycles',
        harmonizedStandard: 'EN 14351-1',
        testMethod: 'EN 1191',
      },
    ],
    ceMarking: {
      issued: true,
      year: new Date(product.created_at).getFullYear(),
    },
    signature: {
      signedBy: 'Jan Jansen',
      position: 'Quality Manager',
      date: new Date(product.created_at).toISOString().split('T')[0],
    },
  };
}

/**
 * Generate DoP for Glass components
 */
export function generateGlassDoP(product: {
  model: string;
  owner: string;
  metadata: any;
  created_at: string;
}): DeclarationOfPerformance {
  const batchNumber = product.metadata?.batch || 'G2024-001';
  const thickness = product.metadata?.thickness || 24;
  
  return {
    dopNumber: `DoP-GLS-${Date.now().toString().slice(-8)}`,
    issueDate: new Date(product.created_at).toISOString().split('T')[0],
    manufacturer: {
      name: 'Premium Glass Manufacturing B.V.',
      address: '456 Glass Avenue, 5678 CD Rotterdam, Netherlands',
      contactInfo: 'info@premiumglass.nl | +31 10 9876543',
    },
    productType: 'Double glazed insulating glass unit',
    productIdentification: {
      productCode: product.model,
      batchNumber: batchNumber,
      serialNumber: `${batchNumber}-${Math.floor(Math.random() * 10000)}`,
    },
    intendedUse: 'Insulating glass unit for windows and facades',
    harmonizedStandard: 'EN 1279-5:2018',
    notifiedBody: {
      name: 'Glass Testing Laboratory Europe',
      number: '0456',
      certification: 'System 1',
    },
    declaredPerformance: [
      {
        characteristic: 'Fire Resistance',
        performance: 'E 30',
        harmonizedStandard: 'EN 13501-2',
        classification: 'Class E',
        testMethod: 'EN 1364-1',
      },
      {
        characteristic: 'Thermal Transmittance (Ug-value)',
        performance: '1.1',
        unit: 'W/(m²·K)',
        harmonizedStandard: 'EN 673',
        testMethod: 'EN 674',
      },
      {
        characteristic: 'Light Transmittance',
        performance: '78',
        unit: '%',
        harmonizedStandard: 'EN 410',
      },
      {
        characteristic: 'Solar Factor (g-value)',
        performance: '0.58',
        harmonizedStandard: 'EN 410',
      },
      {
        characteristic: 'Sound Reduction Index',
        performance: '32',
        unit: 'dB (Rw)',
        harmonizedStandard: 'EN ISO 717-1',
        classification: 'Class 3',
        testMethod: 'EN ISO 10140-2',
      },
      {
        characteristic: 'Impact Resistance',
        performance: '1B1',
        harmonizedStandard: 'EN 356',
        classification: 'Class 1B1',
        testMethod: 'EN 356',
      },
      {
        characteristic: 'Gas Fill',
        performance: '90% Argon',
        harmonizedStandard: 'EN 1279-3',
      },
      {
        characteristic: 'Spacer Type',
        performance: 'Thermally improved',
        harmonizedStandard: 'EN 1279-2',
      },
      {
        characteristic: 'Edge Seal Durability',
        performance: 'Passed',
        harmonizedStandard: 'EN 1279-2',
        testMethod: 'EN 1279-2 (Climate cycling)',
      },
      {
        characteristic: 'Thickness',
        performance: `${thickness}`,
        unit: 'mm',
        harmonizedStandard: 'EN 1279-1',
      },
    ],
    ceMarking: {
      issued: true,
      year: new Date(product.created_at).getFullYear(),
    },
    signature: {
      signedBy: 'Maria van den Berg',
      position: 'Technical Director',
      date: new Date(product.created_at).toISOString().split('T')[0],
    },
  };
}

/**
 * Generate DoP for Frame components
 */
export function generateFrameDoP(product: {
  model: string;
  owner: string;
  metadata: any;
  created_at: string;
}): DeclarationOfPerformance {
  const batchNumber = product.metadata?.batch || 'F2024-001';
  const material = product.metadata?.material || 'Aluminum';
  
  return {
    dopNumber: `DoP-FRM-${Date.now().toString().slice(-8)}`,
    issueDate: new Date(product.created_at).toISOString().split('T')[0],
    manufacturer: {
      name: 'Precision Frame Systems B.V.',
      address: '789 Metal Street, 9012 EF Utrecht, Netherlands',
      contactInfo: 'info@precisionframes.nl | +31 30 5551234',
    },
    productType: `${material} window frame profile system`,
    productIdentification: {
      productCode: product.model,
      batchNumber: batchNumber,
      serialNumber: `${batchNumber}-${Math.floor(Math.random() * 10000)}`,
    },
    intendedUse: 'Window frame for external windows in residential and commercial buildings',
    harmonizedStandard: 'EN 14351-1:2006+A2:2016',
    notifiedBody: {
      name: 'Metal Testing Institute Europe',
      number: '0789',
      certification: 'System 3',
    },
    declaredPerformance: [
      {
        characteristic: 'Fire Resistance',
        performance: 'A2-s1, d0',
        harmonizedStandard: 'EN 13501-1',
        classification: 'Class A2',
        testMethod: 'EN 13823',
      },
      {
        characteristic: 'Thermal Transmittance (Uf-value)',
        performance: '1.4',
        unit: 'W/(m²·K)',
        harmonizedStandard: 'EN ISO 10077-2',
        testMethod: 'EN ISO 12412-2',
      },
      {
        characteristic: 'Corrosion Resistance',
        performance: 'Class 5',
        harmonizedStandard: 'EN 12373-1',
        classification: 'Class 5 (Very high)',
        testMethod: 'EN 12373-1',
      },
      {
        characteristic: 'Surface Quality',
        performance: 'Class 1',
        harmonizedStandard: 'EN 12373-1',
        classification: 'Class 1 (High quality)',
      },
      {
        characteristic: 'Mechanical Strength',
        performance: 'Passed',
        harmonizedStandard: 'EN 14351-1',
        testMethod: 'EN 107, EN 948',
      },
      {
        characteristic: 'Profile Wall Thickness',
        performance: '1.8',
        unit: 'mm',
        harmonizedStandard: 'EN 755-9',
      },
      {
        characteristic: 'Thermal Break',
        performance: 'Polyamide PA 6.6',
        harmonizedStandard: 'EN 14024',
      },
      {
        characteristic: 'Water Drainage',
        performance: 'Multi-chamber system',
        harmonizedStandard: 'EN 14351-1',
      },
      {
        characteristic: 'Chemical Resistance',
        performance: 'Passed',
        harmonizedStandard: 'EN 12373-1',
        testMethod: 'EN 1670',
      },
      {
        characteristic: 'UV Resistance',
        performance: 'No degradation after 2000h',
        harmonizedStandard: 'EN 12373-1',
        testMethod: 'EN ISO 4892-2',
      },
    ],
    ceMarking: {
      issued: true,
      year: new Date(product.created_at).getFullYear(),
    },
    signature: {
      signedBy: 'Peter de Vries',
      position: 'Production Manager',
      date: new Date(product.created_at).toISOString().split('T')[0],
    },
  };
}

/**
 * Get DoP from DPP metadata or generate default
 */
export function getDoP(product: {
  model: string;
  owner: string;
  metadata: any;
  created_at: string;
  type: 'main' | 'component';
}): DeclarationOfPerformance | null {
  // Check if DoP exists in metadata
  if (product.metadata?.declarationOfPerformance) {
    return product.metadata.declarationOfPerformance as DeclarationOfPerformance;
  }
  
  // Otherwise generate default DoP
  return generateDoP(product);
}

/**
 * Get appropriate DoP generator based on product type
 */
export function generateDoP(product: {
  model: string;
  owner: string;
  metadata: any;
  created_at: string;
  type: 'main' | 'component';
}): DeclarationOfPerformance | null {
  const model = product.model.toLowerCase();
  
  if (product.type === 'main' || model.includes('window')) {
    return generateWindowDoP(product);
  } else if (model.includes('glass')) {
    return generateGlassDoP(product);
  } else if (model.includes('frame')) {
    return generateFrameDoP(product);
  }
  
  return null;
}
