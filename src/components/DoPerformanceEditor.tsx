import { useState } from 'react';
import { Plus, Trash2, Save, X } from 'lucide-react';
import type { DeclarationOfPerformance, PerformanceCharacteristic } from '../lib/schemas/declarationOfPerformance';

interface DoPerformanceEditorProps {
  initialData?: DeclarationOfPerformance | null;
  productType: 'main' | 'component';
  onSave: (dop: DeclarationOfPerformance) => void;
  onCancel: () => void;
}

export default function DoPerformanceEditor({ 
  initialData, 
  productType,
  onSave, 
  onCancel 
}: DoPerformanceEditorProps) {
  const [dop, setDop] = useState<DeclarationOfPerformance>(
    initialData || getDefaultDoP(productType)
  );

  const handleAddCharacteristic = () => {
    setDop({
      ...dop,
      declaredPerformance: [
        ...dop.declaredPerformance,
        {
          characteristic: '',
          performance: '',
          harmonizedStandard: '',
          classification: '',
          unit: '',
          testMethod: '',
        },
      ],
    });
  };

  const handleRemoveCharacteristic = (index: number) => {
    const updated = [...dop.declaredPerformance];
    updated.splice(index, 1);
    setDop({ ...dop, declaredPerformance: updated });
  };

  const handleCharacteristicChange = (
    index: number,
    field: keyof PerformanceCharacteristic,
    value: string
  ) => {
    const updated = [...dop.declaredPerformance];
    updated[index] = { ...updated[index], [field]: value };
    setDop({ ...dop, declaredPerformance: updated });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(dop);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
            <h2 className="text-xl font-bold">Edit Declaration of Performance</h2>
            <button
              type="button"
              onClick={onCancel}
              className="text-white hover:text-gray-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Basic Information</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DoP Number
                  </label>
                  <input
                    type="text"
                    value={dop.dopNumber}
                    onChange={(e) => setDop({ ...dop, dopNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={dop.issueDate}
                    onChange={(e) => setDop({ ...dop, issueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Product Type
                </label>
                <input
                  type="text"
                  value={dop.productType}
                  onChange={(e) => setDop({ ...dop, productType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Intended Use
                </label>
                <input
                  type="text"
                  value={dop.intendedUse}
                  onChange={(e) => setDop({ ...dop, intendedUse: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Harmonized Standard
                </label>
                <input
                  type="text"
                  value={dop.harmonizedStandard}
                  onChange={(e) => setDop({ ...dop, harmonizedStandard: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., EN 14351-1:2006+A2:2016"
                  required
                />
              </div>
            </div>

            {/* Manufacturer */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Manufacturer</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={dop.manufacturer.name}
                  onChange={(e) =>
                    setDop({
                      ...dop,
                      manufacturer: { ...dop.manufacturer, name: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={dop.manufacturer.address}
                  onChange={(e) =>
                    setDop({
                      ...dop,
                      manufacturer: { ...dop.manufacturer, address: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Info</label>
                <input
                  type="text"
                  value={dop.manufacturer.contactInfo}
                  onChange={(e) =>
                    setDop({
                      ...dop,
                      manufacturer: { ...dop.manufacturer, contactInfo: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
            </div>

            {/* Performance Characteristics */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">Performance Characteristics</h3>
                <button
                  type="button"
                  onClick={handleAddCharacteristic}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Characteristic
                </button>
              </div>

              <div className="space-y-4">
                {dop.declaredPerformance.map((perf, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        Characteristic #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCharacteristic(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Characteristic
                        </label>
                        <input
                          type="text"
                          value={perf.characteristic}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'characteristic', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Fire Resistance"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Performance
                        </label>
                        <input
                          type="text"
                          value={perf.performance}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'performance', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., E 30"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Unit (optional)
                        </label>
                        <input
                          type="text"
                          value={perf.unit || ''}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'unit', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., W/(m²·K)"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Classification (optional)
                        </label>
                        <input
                          type="text"
                          value={perf.classification || ''}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'classification', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., Class E"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Harmonized Standard
                        </label>
                        <input
                          type="text"
                          value={perf.harmonizedStandard}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'harmonizedStandard', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., EN 13501-2"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Test Method (optional)
                        </label>
                        <input
                          type="text"
                          value={perf.testMethod || ''}
                          onChange={(e) =>
                            handleCharacteristicChange(index, 'testMethod', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                          placeholder="e.g., EN 1634-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save DoP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getDefaultDoP(productType: 'main' | 'component'): DeclarationOfPerformance {
  const now = new Date().toISOString().split('T')[0];
  
  return {
    dopNumber: `DoP-${productType === 'main' ? 'WIN' : 'CMP'}-${Date.now().toString().slice(-8)}`,
    issueDate: now,
    manufacturer: {
      name: '',
      address: '',
      contactInfo: '',
    },
    productType: productType === 'main' ? 'Window product' : 'Component',
    productIdentification: {
      productCode: '',
      batchNumber: '',
      serialNumber: '',
    },
    intendedUse: '',
    harmonizedStandard: '',
    notifiedBody: {
      name: '',
      number: '',
      certification: '',
    },
    declaredPerformance: [],
    ceMarking: {
      issued: true,
      year: new Date().getFullYear(),
    },
    signature: {
      signedBy: '',
      position: '',
      date: now,
    },
  };
}
