import { useState, useEffect } from 'react';
import Modal from './Modal';
import { supabase } from '../../lib/supabase';

export default function OnboardingTour({ user, onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const steps = [
        {
            title: '👋 Welcome to Site Organizer!',
            description: "Let's take a quick tour to help you get started. You'll learn how to organize your bookmarks in just 3 simple steps.",
            icon: '🚀'
        },
        {
            title: '📌 Step 1: Add Your First Site',
            description: 'Click the "+ Add Site" button to save your favorite websites. You can add URLs, titles, and descriptions. Try adding one now!',
            icon: '🌐',
            highlight: 'add-site-button'
        },
        {
            title: '🏷️ Step 2: Organize with Categories & Tags',
            description: 'Create categories (like "Work", "Social Media") and tags to organize your sites. Find them in the sidebar or use the Categories and Tags tabs.',
            icon: '📂',
            highlight: 'sidebar-categories'
        },
        {
            title: '⭐ Step 3: Mark Favorites & Search',
            description: 'Star your most important sites for quick access. Use the search bar (press Ctrl+K) to find anything instantly!',
            icon: '🔍',
            highlight: 'favorites-tab'
        },
        {
            title: '🎉 You\'re All Set!',
            description: 'That\'s it! Start adding your sites and organizing them your way. You can always access settings from the top-right menu.',
            icon: '✨'
        }
    ];

    useEffect(() => {
        const checkOnboarding = async () => {
            if (!user?.id || !supabase) return;

            try {
                // Check if user has completed onboarding
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const hasCompletedOnboarding = authUser?.user_metadata?.onboarding_completed;

                if (!hasCompletedOnboarding) {
                    // Small delay to let dashboard load first
                    setTimeout(() => setIsOpen(true), 800);
                }
            } catch (err) {
                console.error('[OnboardingTour] Error checking onboarding status:', err);
            }
        };

        checkOnboarding();
    }, [user?.id]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = async () => {
        if (!supabase) {
            console.warn('[OnboardingTour] Supabase not available');
            setIsOpen(false);
            if (onComplete) onComplete();
            return;
        }

        try {
            // Mark onboarding as completed in user metadata
            await supabase.auth.updateUser({
                data: {
                    onboarding_completed: true
                }
            });
        } catch (err) {
            console.error('[OnboardingTour] Error marking onboarding complete:', err);
        }

        setIsOpen(false);
        if (onComplete) onComplete();
    };

    const currentStepData = steps[currentStep];
    const isFirstStep = currentStep === 0;
    const isLastStep = currentStep === steps.length - 1;

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleSkip}
            title=""
            showCloseButton={false}
        >
            <div className="text-center">
                {/* Large Icon */}
                <div className="text-6xl mb-4">
                    {currentStepData.icon}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-app-text-primary mb-3">
                    {currentStepData.title}
                </h2>

                {/* Description */}
                <p className="text-app-text-secondary text-base mb-6 leading-relaxed max-w-md mx-auto">
                    {currentStepData.description}
                </p>

                {/* Progress Dots */}
                <div className="flex justify-center gap-2 mb-6">
                    {steps.map((_, index) => (
                        <div
                            key={index}
                            className={`h-2 rounded-full transition-all ${
                                index === currentStep
                                    ? 'w-8 bg-app-primary'
                                    : index < currentStep
                                    ? 'w-2 bg-app-primary/50'
                                    : 'w-2 bg-app-border'
                            }`}
                        />
                    ))}
                </div>

                {/* Step Counter */}
                <p className="text-sm text-app-text-tertiary mb-6">
                    Step {currentStep + 1} of {steps.length}
                </p>

                {/* Buttons */}
                <div className="flex gap-3 justify-center">
                    {!isFirstStep && (
                        <button
                            onClick={handlePrevious}
                            className="px-6 py-2.5 bg-app-bg-secondary border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-light transition-colors font-medium"
                        >
                            ← Previous
                        </button>
                    )}
                    
                    {!isLastStep && (
                        <button
                            onClick={handleSkip}
                            className="px-6 py-2.5 text-app-text-secondary hover:text-app-text-primary transition-colors font-medium"
                        >
                            Skip Tour
                        </button>
                    )}

                    <button
                        onClick={handleNext}
                        className="px-6 py-2.5 bg-app-primary text-white rounded-lg hover:bg-app-primary-hover transition-colors font-medium"
                    >
                        {isLastStep ? '🎉 Get Started' : 'Next →'}
                    </button>
                </div>

                {/* Keyboard hint */}
                <p className="text-xs text-app-text-tertiary mt-4">
                    Press <kbd className="px-1.5 py-0.5 bg-app-bg-secondary border border-app-border rounded text-xs">Esc</kbd> to skip
                </p>
            </div>
        </Modal>
    );
}
