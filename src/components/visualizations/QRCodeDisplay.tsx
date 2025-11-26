import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import QRCode from 'qrcode';
import { generateQRCodeData } from '../../lib/operations/dppManagerLocal';

export default function QRCodeDisplay({ did, onClose }: { did: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    generateQR();
  }, [did]);

  async function generateQR() {
    if (!canvasRef.current) return;

    const qrData = generateQRCodeData(did);
    const dataString = JSON.stringify(qrData);

    try {
      await QRCode.toCanvas(canvasRef.current, dataString, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">QR Code</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} className="border border-gray-200 rounded-lg"></canvas>
        </div>

        <div className="text-sm text-gray-600">
          <p className="font-medium mb-2">DID:</p>
          <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">{did}</p>
        </div>
      </div>
    </div>
  );
}
