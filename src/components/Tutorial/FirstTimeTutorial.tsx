import { useState } from 'react';
import { Camera, Move, Crosshair, Home, FileText, ChevronRight, X } from 'lucide-react';

interface FirstTimeTutorialProps {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Measure Real-World Spaces With Your Camera',
    desc: 'Turn your device into a precision AR tape measure, distance meter, angle finder, and 3D room scanner.',
    icon: <Camera className="w-8 h-8 text-amber-500" />,
    badge: 'Step 1 of 5'
  },
  {
    title: 'Point Camera at a Surface',
    desc: 'Move slowly across floors, walls, or tables. The application detects 3D planes and displays optical feature points.',
    icon: <Move className="w-8 h-8 text-amber-500" />,
    badge: 'Step 2 of 5'
  },
  {
    title: 'Aim & Tap to Place Points',
    desc: 'Align the center reticle with your start point and tap START. Move phone to destination and tap END to lock 3D measurements.',
    icon: <Crosshair className="w-8 h-8 text-amber-500" />,
    badge: 'Step 3 of 5'
  },
  {
    title: 'Scan Rooms & Plan 2D Layouts',
    desc: 'Walk around room corners to automatically construct 2D floor plans, place furniture, and preview in interactive 3D.',
    icon: <Home className="w-8 h-8 text-amber-500" />,
    badge: 'Step 4 of 5'
  },
  {
    title: 'Save & Export Architectural PDF Reports',
    desc: 'Generate multi-page professional PDF surveys with 2D drawings, scale bars, north orientation, and dimensional schedules.',
    icon: <FileText className="w-8 h-8 text-amber-500" />,
    badge: 'Step 5 of 5'
  }
];

export function FirstTimeTutorial({ onComplete }: FirstTimeTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(s => s + 1);
    }
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center relative">
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon Container */}
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4 mt-2">
          {step.icon}
        </div>

        <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wider mb-2">
          {step.badge}
        </span>

        <h3 className="text-lg font-bold text-white mb-2 leading-snug">
          {step.title}
        </h3>

        <p className="text-xs text-slate-400 leading-relaxed mb-6">
          {step.desc}
        </p>

        {/* Dot Indicators */}
        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep ? 'w-6 bg-amber-500' : 'w-1.5 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="w-full flex items-center gap-2">
          <button
            onClick={onComplete}
            className="flex-1 py-3 text-xs font-semibold text-slate-400 hover:text-white rounded-xl transition-colors"
          >
            Skip Tutorial
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-1 transition-all active:scale-95"
          >
            <span>{isLast ? 'Get Started' : 'Next'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
