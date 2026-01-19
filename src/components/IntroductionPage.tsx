import { useState } from 'react';
import {
  Shield,
  Eye,
  Search,
  Recycle,
  FileCheck,
  ArrowRight,
  ArrowLeft,
  X,
  Building2,
  Factory,
  Workflow,
  Scale
} from 'lucide-react';
import EcosystemView from './visualizations/EcosystemView';

interface IntroductionPageProps {
  onContinue: () => void;
}

export default function IntroductionPage({ onContinue }: IntroductionPageProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    { component: <WelcomeStep /> },
    { component: <PlayersStep /> },
    { component: <StoryStep /> },
    { component: <TrustStep /> },
    { component: <ValueStep /> }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onContinue();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex flex-col transition-colors">
      {/* Header with Progress and Skip */}
      <div className="px-6 py-8 flex justify-end items-center max-w-6xl mx-auto w-full">
        <button
          onClick={onContinue}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          Skip Intro <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6">
        <div className="max-w-[1600px] w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          {steps[currentStep].component}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky bottom-0 transition-colors z-50">
        <div className="max-w-5xl mx-auto grid grid-cols-3 items-center">
          <div className="flex justify-start">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${currentStep === 0
                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                }`}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
          </div>

          <div className="flex justify-center gap-3">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 w-12 rounded-full transition-all duration-300 ${idx <= currentStep ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
              />
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next Step'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="text-center max-w-3xl mx-auto">
      <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-600 rounded-3xl mb-8 shadow-xl shadow-blue-200">
        <FileCheck className="w-12 h-12 text-white" />
      </div>

      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
        DPP Trust Anchor
      </h1>

      <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed">
        Building trust in the circular economy through transparent, verifiable product data.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-left transition-colors">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-sm">1</span>
          Why Does This System Exist?
        </h2>
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 text-lg">
          In a circular economy, products like windows move through many hands—from
          manufacturers to installers to recyclers. The challenge is: <strong>How do you trust the data?</strong>
        </p>
        <p className="text-gray-700 dark:text-gray-400 leading-relaxed text-lg font-medium bg-blue-50/50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
          This system gives every product a <strong>Digital Product Passport</strong> (technically known as a <strong>DID</strong>).
          Think of it as an unforgeable birth certificate that travels with the product
          forever, recording every significant event along the way.
        </p>
      </div>
    </div>
  );
}

function PlayersStep() {
  return (
    <div className="w-full">
      <EcosystemView />
    </div>
  );
}

function StoryStep() {
  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">The Trust Story</h2>
        <p className="text-xl text-gray-600 dark:text-gray-300">How a smart window moves through the trust network.</p>
      </div>

      <div className="relative py-8">
        {/* Horizontal Line for Desktop - Positioned behind the icons */}
        <div className="hidden md:block absolute top-[64px] left-[10%] right-[10%] h-0.5 bg-gray-200 dark:bg-gray-700 z-0" />

        <div className="grid md:grid-cols-4 gap-8 relative z-10">
          {/* Step 1: Production */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-blue-500 flex items-center justify-center mb-6 shadow-lg group hover:scale-110 transition-transform relative z-10">
              <Factory className="w-8 h-8 text-blue-500" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-center text-lg mb-1">CrystalGlass</h4>
            <p className="text-[10px] px-2 py-0.5 bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold mb-3 uppercase tracking-wider rounded-full border border-blue-100 dark:border-blue-800">Material Producer</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              Produces the tempered glass and registers the first digital identity.
            </p>
          </div>

          {/* Step 2: Assembly */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl border-2 border-indigo-500 flex items-center justify-center mb-6 shadow-lg group hover:scale-110 transition-transform relative z-10">
              <Workflow className="w-8 h-8 text-indigo-500" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-center text-lg mb-1">EcoFrame</h4>
            <p className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold mb-3 uppercase tracking-wider rounded-full border border-indigo-100 dark:border-indigo-800">Manufacturer</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              Builds the final window and links all components together.
            </p>
          </div>

          {/* Step 3: Witnessing */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group hover:scale-110 transition-transform shadow-emerald-200 dark:shadow-none relative z-10">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-center text-lg mb-1">DLT Foundation</h4>
            <p className="text-[10px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 font-bold mb-3 uppercase tracking-wider rounded-full border border-emerald-100 dark:border-emerald-800">Legal Witness</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              The <strong>Witness</strong>. Anchors data to blockchain for legal proof.
            </p>
          </div>

          {/* Step 4: Monitoring */}
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg group hover:scale-110 transition-transform shadow-amber-200 dark:shadow-none relative z-10">
              <Eye className="w-8 h-8 text-white" />
            </div>
            <h4 className="font-bold text-gray-900 dark:text-white text-center text-lg mb-1">TrustGuard</h4>
            <p className="text-[10px] px-2 py-0.5 bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-bold mb-3 uppercase tracking-wider rounded-full border border-amber-100 dark:border-amber-800">Security Watcher</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              The <strong>Watcher</strong>. Alerts everyone if the data is touched.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-gray-100 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-center gap-6">
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <Scale className="w-8 h-8 text-slate-500 mx-auto" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Independence is Key</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The Witness (Foundation) and Watcher (Auditor) are <strong>independent legal entities</strong>.
            They don't produce the goods, but they provide the "Proof of Trust" that ensures manufacturers like EcoFrame aren't marking their own homework.
          </p>
        </div>
      </div>
    </div>
  );
}

function TrustStep() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Under the Hood</h2>
        <p className="text-xl text-gray-600 dark:text-gray-300">Three digital guardians work together to ensure trust.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Witnesses */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-center">
            <Shield className="w-12 h-12 text-white mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white">Witnesses</h3>
            <p className="text-emerald-100 text-sm">The Digital Notaries</p>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <p className="text-gray-700 dark:text-gray-300 mb-4 flex-1">
              When an event happens (like production), a Witness reviews and digitally signs it.
            </p>
            <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-3 text-sm text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50">
              <strong>Analogy:</strong> Like a notary public stamping a document to prove it's official.
            </div>
          </div>
        </div>

        {/* Watchers */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-center">
            <Eye className="w-12 h-12 text-white mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white">Watchers</h3>
            <p className="text-amber-100 text-sm">The Security Guards</p>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <p className="text-gray-700 dark:text-gray-300 mb-4 flex-1">
              They continuously monitor data for tampering and verify that components belong to the right products.
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-800/50">
              <strong>Analogy:</strong> Security cameras and inspectors that raise an alarm if something looks wrong.
            </div>
          </div>
        </div>

        {/* Resolvers */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-center">
            <Search className="w-12 h-12 text-white mx-auto mb-3" />
            <h3 className="text-xl font-bold text-white">Resolvers</h3>
            <p className="text-blue-100 text-sm">The Digital Phonebook</p>
          </div>
          <div className="p-6 flex-1 flex flex-col">
            <p className="text-gray-700 dark:text-gray-300 mb-4 flex-1">
              Looks up the unique ID (DID) and retrieves the full, verified history of the product.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
              <strong>Analogy:</strong> A search engine that finds the right file instantly when you scan a code.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValueStep() {
  return (
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Why Does This Matter?</h2>

      <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-3xl p-10 text-white shadow-xl mb-10">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Search className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Transparency</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              No hidden surprises. Every step is recorded.
            </p>
          </div>
          <div>
            <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Trust</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Independent guardians ensure data is authentic.
            </p>
          </div>
          <div>
            <div className="bg-white/20 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Recycle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Circularity</h3>
            <p className="text-blue-100 text-sm leading-relaxed">
              Smarter reuse through better data.
            </p>
          </div>
        </div>
      </div>

      <p className="text-gray-600 dark:text-gray-300 text-lg mb-8">
        You are now ready to explore the dashboard. Remember, you can always revisit this guide by clicking the help icon.
      </p>
    </div>
  );
}
