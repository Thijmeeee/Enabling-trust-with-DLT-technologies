import { useState, useEffect } from 'react';
import { 
  Shield, 
  MapPin, 
  Calendar, 
  Leaf, 
  Award,
  CheckCircle,
  ChevronRight,
  Wrench,
  Share2,
  ExternalLink,
  Package,
  Download
} from 'lucide-react';
import { enhancedDB } from '../../lib/data/enhancedDataStore';
import type { DPP } from '../../lib/data/localData';

interface ConsumerViewProps {
  did?: string;
  onNavigate?: (did: string) => void;
}

export default function ConsumerView({ did, onNavigate }: ConsumerViewProps) {
  const [product, setProduct] = useState<DPP | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'story' | 'maintenance' | 'warranty'>('story');

  useEffect(() => {
    if (did) {
      loadProduct(did);
    } else {
      loadRandomProduct();
    }
  }, [did]);

  async function loadProduct(productDid: string) {
    setLoading(true);
    try {
      const dpp = await enhancedDB.getDPPByDID(productDid);
      setProduct(dpp);
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadRandomProduct() {
    setLoading(true);
    try {
      const allDpps = await enhancedDB.getAllDPPs();
      const mainProducts = allDpps.filter(dpp => dpp.type === 'main');
      if (mainProducts.length > 0) {
        const randomProduct = mainProducts[Math.floor(Math.random() * mainProducts.length)];
        setProduct(randomProduct);
      }
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Product not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50">
      {/* Hero Section - Mobile First */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-lg mx-auto px-6 py-8">
          {/* Trust Badge */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
              <Shield className="w-4 h-4 text-green-300" />
              <span className="text-sm font-medium">Verified Product</span>
            </div>
          </div>

          {/* Product Name */}
          <h1 className="text-3xl font-bold mb-2">{product.model}</h1>
          <p className="text-blue-200 mb-6">
            {(product.metadata?.productType as string) || 'Premium Window'}
          </p>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Leaf className="w-4 h-4 text-green-300" />
                <span className="text-sm text-blue-200">Sustainability</span>
              </div>
              <p className="text-xl font-bold">A+</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-300" />
                <span className="text-sm text-blue-200">Produced</span>
              </div>
              <p className="text-xl font-bold">
                {new Date(product.created_at).toLocaleDateString('en-US', { 
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 -mt-4">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-lg mb-6 overflow-hidden border border-blue-200">
          <div className="flex border-b border-blue-100">
            {[
              { id: 'story', label: 'Story', icon: MapPin },
              { id: 'maintenance', label: 'Maintenance', icon: Wrench },
              { id: 'warranty', label: 'Warranty', icon: Award },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 flex flex-col items-center gap-1 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-5 h-5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'story' && (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">The journey of your window</h3>
                  <div className="space-y-4">
                    {/* Timeline */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="w-0.5 h-full bg-blue-200 my-2" />
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-gray-900">Manufactured</p>
                        <p className="text-sm text-gray-500">
                          {new Date(product.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Expertly crafted in the Netherlands
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="w-0.5 h-full bg-blue-200 my-2" />
                      </div>
                      <div className="pb-4">
                        <p className="font-medium text-gray-900">Quality Control</p>
                        <p className="text-sm text-gray-600">
                          Tested and approved according to EN 14351-1
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                          <Award className="w-4 h-4 text-purple-600" />
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Certified</p>
                        <p className="text-sm text-gray-600">
                          CE marking and KOMO quality mark
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Origin Info */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Leaf className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-green-900">Sustainably produced</p>
                      <p className="text-sm text-green-700">100% recyclable materials</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'maintenance' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Maintenance Tips</h3>
                
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Regular Cleaning</p>
                      <p className="text-sm text-gray-600">
                        Clean the frame monthly with a damp cloth and mild soap.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Lubricate Hinges</p>
                      <p className="text-sm text-gray-600">
                        Apply silicone spray to hinges annually.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 p-3 bg-blue-50 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-blue-600">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Check Seals</p>
                      <p className="text-sm text-gray-600">
                        Inspect rubber seals for wear and replace if needed.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const manualContent = `
# Maintenance Manual - ${product.model}

## Regular Cleaning
Clean the frame monthly with a damp cloth and mild soap.

## Lubricate Hinges  
Apply silicone spray to hinges annually.

## Check Seals
Inspect rubber seals for wear and replace if needed.

## Annual Inspection
Have a professional inspect the window annually.

Product DID: ${product.did}
                    `;
                    const blob = new Blob([manualContent], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `maintenance-manual-${product.model.replace(/\s+/g, '-')}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="w-full py-3 bg-blue-50 text-blue-600 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Full Manual
                </button>
              </div>
            )}

            {activeTab === 'warranty' && (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <Award className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">10 Year Warranty</h3>
                  <p className="text-gray-500">Valid until {
                    new Date(new Date(product.created_at).getTime() + 10 * 365 * 24 * 60 * 60 * 1000)
                      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                  }</p>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Manufacturing defects covered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Material warranty</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700">Free replacement parts</span>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    const subject = encodeURIComponent(`Warranty Claim - ${product.model}`);
                    const body = encodeURIComponent(`
Product: ${product.model}
DID: ${product.did}
Warranty valid until: ${new Date(new Date(product.created_at).getTime() + 10 * 365 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}

Please describe your issue:

                    `);
                    window.open(`mailto:warranty@manufacturer.com?subject=${subject}&body=${body}`);
                    alert('Opening email client to submit warranty claim...');
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors"
                >
                  Submit Warranty Claim
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Share Button */}
        <div className="flex gap-3 mb-8">
          <button 
            onClick={() => {
              const shareUrl = `${window.location.origin}/product/${product.did}`;
              if (navigator.share) {
                navigator.share({
                  title: product.model,
                  text: `Check out this verified product: ${product.model}`,
                  url: shareUrl
                });
              } else {
                navigator.clipboard.writeText(shareUrl);
                alert('Product link copied to clipboard!');
              }
            }}
            className="flex-1 py-3 bg-white border border-blue-200 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2 shadow-sm hover:bg-blue-50 transition-colors"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          <button 
            onClick={() => onNavigate?.(product.did)}
            className="flex-1 py-3 bg-white border border-blue-200 rounded-xl font-medium text-gray-700 flex items-center justify-center gap-2 shadow-sm hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Technical Details
          </button>
        </div>

        {/* Trust Footer */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-400">
            Verified by Digital Product Passport
          </p>
          <p className="text-xs text-gray-400 font-mono mt-1">
            {product.did.slice(0, 30)}...
          </p>
        </div>
      </div>
    </div>
  );
}
