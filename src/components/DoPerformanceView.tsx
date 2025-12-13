import { Shield, CheckCircle, FileText, Award, Edit } from 'lucide-react';
import type { DeclarationOfPerformance } from '../lib/schemas/declarationOfPerformance';

interface DoPerformanceViewProps {
  dop: DeclarationOfPerformance;
  onEdit?: () => void;
}

export default function DoPerformanceView({ dop, onEdit }: DoPerformanceViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-8 h-8" />
              <h2 className="text-2xl font-bold">Declaration of Performance</h2>
            </div>
            <p className="text-blue-100">According to EU Construction Products Regulation (CPR) 305/2011</p>
          </div>
          <div className="flex items-center gap-3">
            {onEdit && (
              <button
                onClick={onEdit}
                className="bg-white text-blue-900 px-4 py-2 rounded-lg hover:bg-blue-50 flex items-center gap-2 font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit DoP
              </button>
            )}
            {dop.ceMarking.issued && (
              <div className="bg-white text-blue-900 px-4 py-2 rounded-lg font-bold text-center">
                <div className="text-2xl">CE</div>
                <div className="text-xs">{dop.ceMarking.year}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DoP Number and Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">DoP Number</div>
          <div className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">{dop.dopNumber}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Issue Date</div>
          <div className="font-semibold text-lg text-gray-900 dark:text-white">{dop.issueDate}</div>
        </div>
      </div>

      {/* Manufacturer Information */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Manufacturer Information
        </h3>
        <div className="space-y-2">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Name: </span>
            <span className="font-medium text-gray-900 dark:text-white">{dop.manufacturer.name}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Address: </span>
            <span className="font-medium text-gray-900 dark:text-white">{dop.manufacturer.address}</span>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Contact: </span>
            <span className="font-medium text-gray-900 dark:text-white">{dop.manufacturer.contactInfo}</span>
          </div>
        </div>
      </div>

      {/* Product Information */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Product Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Product Type</div>
            <div className="font-medium text-gray-900 dark:text-white">{dop.productType}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Intended Use</div>
            <div className="font-medium text-gray-900 dark:text-white">{dop.intendedUse}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Product Code</div>
            <div className="font-mono text-gray-900 dark:text-white">{dop.productIdentification.productCode}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Batch Number</div>
            <div className="font-mono text-gray-900 dark:text-white">{dop.productIdentification.batchNumber}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Serial Number</div>
            <div className="font-mono text-gray-900 dark:text-white">{dop.productIdentification.serialNumber}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Harmonized Standard</div>
            <div className="font-mono text-sm text-gray-900 dark:text-white">{dop.harmonizedStandard}</div>
          </div>
        </div>
      </div>

      {/* Notified Body */}
      {dop.notifiedBody && (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-6 transition-colors">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notified Body</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Name</div>
              <div className="font-medium text-gray-900 dark:text-white">{dop.notifiedBody.name}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Number</div>
              <div className="font-mono font-semibold text-gray-900 dark:text-white">{dop.notifiedBody.number}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Certification System</div>
              <div className="font-medium text-gray-900 dark:text-white">{dop.notifiedBody.certification}</div>
            </div>
          </div>
        </div>
      )}

      {/* Declared Performance - Main Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          Declared Performance Characteristics
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Characteristic</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Performance</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Classification</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Standard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dop.declaredPerformance.map((perf, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-900 dark:text-white">{perf.characteristic}</div>
                    {perf.testMethod && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Test: {perf.testMethod}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-baseline gap-1">
                      <span className="font-semibold text-blue-600 dark:text-blue-400">{perf.performance}</span>
                      {perf.unit && <span className="text-sm text-gray-600 dark:text-gray-400">{perf.unit}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    {perf.classification ? (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded text-sm font-medium">
                        {perf.classification}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{perf.harmonizedStandard}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {dop.declaredPerformance.slice(0, 4).map((perf, index) => (
          <div key={index} className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/30 dark:to-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg p-4 text-center transition-colors">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">{perf.characteristic}</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{perf.performance}</div>
            {perf.unit && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{perf.unit}</div>}
            {perf.classification && (
              <div className="mt-2 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded text-xs font-medium inline-block">
                {perf.classification}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Signature */}
      <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6 transition-colors">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Declaration</h3>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          The performance of the product identified above is in conformity with the set of declared performance characteristics.
          This declaration of performance is issued, in accordance with Regulation (EU) No 305/2011, under the sole responsibility of the manufacturer identified above.
        </p>
        <div className="flex items-end justify-between mt-6 pt-4 border-t border-gray-300 dark:border-gray-600">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Signed by</div>
            <div className="font-semibold text-lg text-gray-900 dark:text-white">{dop.signature.signedBy}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{dop.signature.position}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500 dark:text-gray-400">Date</div>
            <div className="font-semibold text-gray-900 dark:text-white">{dop.signature.date}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
