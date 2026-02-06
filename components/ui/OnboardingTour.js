import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useDashboard } from '../../context/DashboardContext';

export default function OnboardingTour({ user, onComplete }) {
    const [currentStep, setCurrentStep] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightRect, setHighlightRect] = useState(null);
    const prevSitesCountRef = useRef(0);
    const [inAddSiteFlow, setInAddSiteFlow] = useState(false); // Track if user clicked Add Site
    const [isMobile, setIsMobile] = useState(false);

    // Get sites from dashboard context to detect when new site is added
    const { sites } = useDashboard();

    // Detect mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768); // md breakpoint
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Desktop steps
    const desktopSteps = useMemo(() => [
        {
            title: 'Welcome to Site Organizer!',
            description: "Let's take a quick tour to help you get started organizing your bookmarks.",
            icon: '👋',
            target: null
        },
        {
            title: 'Add Your First Site',
            description: 'Click this button to save your favorite websites. You can add URLs, titles, and organize them.',
            icon: '➕',
            target: '[data-tour="add-button"]',
            position: 'bottom'
        },
        {
            title: 'Fill Site Details',
            description: 'Enter the URL, name, and choose categories & tags. Click "Add Site" when done!',
            icon: '📝',
            target: '[data-tour="site-modal"]',
            position: 'right',
            waitForElement: true
        },
        {
            title: 'Site Card Actions',
            description: 'Hover over a site to see actions: ⭐ Favorite, 📌 Pin to top, 🔗 Visit, ✏️ Edit, and 🗑️ Delete. Double-click title to rename.',
            icon: '🃏',
            target: '[data-tour="site-card"]',
            position: 'bottom',
            waitForElement: true
        },
        {
            title: 'Browse Your Sites',
            description: 'All your saved sites appear here. Click on any site to view or edit it.',
            icon: '🌐',
            target: '[data-tour="sites-tab"]',
            position: 'right'
        },
        {
            title: 'Quick Access Favorites',
            description: 'Star important sites and find them here for quick access.',
            icon: '⭐',
            target: '[data-tour="favorites-tab"]',
            position: 'right'
        },
        {
            title: 'Organize with Categories',
            description: 'Create categories like "Work", "Social", "Tools" to group your sites.',
            icon: '📁',
            target: '[data-tour="categories-tab"]',
            position: 'right'
        },
        {
            title: 'Tag Your Sites',
            description: 'Add tags for flexible organization. Sites can have multiple tags.',
            icon: '🏷️',
            target: '[data-tour="tags-tab"]',
            position: 'right'
        },
        {
            title: 'Settings',
            description: 'Customize your profile, security settings, and import/export your data.',
            icon: '⚙️',
            target: '[data-tour="settings-tab"]',
            position: 'right'
        },
        {
            title: 'Sort Your Content',
            description: 'Change how items are sorted - by name, date created, or other criteria.',
            icon: '📊',
            target: '[data-tour="sorting"]',
            position: 'right'
        },
        {
            title: 'Filter by Category & Tag',
            description: 'Quickly filter your sites by category or tag to find what you need.',
            icon: '🔎',
            target: '[data-tour="filters"]',
            position: 'right'
        },
        {
            title: 'Multi-Select Mode',
            description: 'Select multiple items at once for bulk actions like delete. Press M to toggle.',
            icon: '☑️',
            target: '[data-tour="select-mode"]',
            position: 'bottom'
        },
        {
            title: 'Quick Search',
            description: 'Press Ctrl+K (or Cmd+K) anytime to quickly search all your sites.',
            icon: '🔍',
            target: '[data-tour="search-bar"]',
            position: 'bottom'
        },
        {
            title: 'Command Menu',
            description: 'Press Ctrl+/ to open Command Menu. Quick access to all actions, navigation, and keyboard shortcuts!',
            icon: '⌨️',
            target: null
        },
        {
            title: "You're All Set!",
            description: 'Start adding your sites and organizing them your way. Have fun!',
            icon: '🎉',
            target: null
        }
    ], []);

    // Mobile steps
    const mobileSteps = useMemo(() => [
        {
            title: 'Welcome to Site Organizer!',
            description: "Let's take a quick tour to help you get started organizing your bookmarks.",
            icon: '👋',
            target: null
        },
        {
            title: 'Add Your First Site',
            description: 'Tap this button to save your favorite websites.',
            icon: '➕',
            target: '[data-tour="mobile-add-button"]',
            position: 'bottom'
        },
        {
            title: 'Open Navigation Menu',
            description: 'Tap this button to open the navigation menu, or tap Next to continue.',
            icon: '☰',
            target: '[data-tour="mobile-menu"]',
            position: 'bottom'
        },
        {
            title: 'Sites Tab',
            description: 'View all your saved websites here.',
            icon: '🌐',
            target: '[data-tour="sites-tab"]',
            position: 'right',
            requiresMenu: true
        },
        {
            title: 'Favorites Tab',
            description: 'Quick access to your favorite sites.',
            icon: '⭐',
            target: '[data-tour="favorites-tab"]',
            position: 'right',
            requiresMenu: true
        },
        {
            title: 'Categories Tab',
            description: 'Organize sites into categories like Work, Personal, etc.',
            icon: '📁',
            target: '[data-tour="categories-tab"]',
            position: 'right',
            requiresMenu: true
        },
        {
            title: 'Tags Tab',
            description: 'Use tags to label and filter your sites.',
            icon: '🏷️',
            target: '[data-tour="tags-tab"]',
            position: 'right',
            requiresMenu: true
        },
        {
            title: 'Settings Tab',
            description: 'Customize your profile and app settings.',
            icon: '⚙️',
            target: '[data-tour="settings-tab"]',
            position: 'right',
            requiresMenu: true
        },
        {
            title: 'Multi-Select Mode',
            description: 'Tap to select multiple items at once for bulk actions like delete.',
            icon: '☑️',
            target: '[data-tour="select-mode"]',
            position: 'bottom'
        },
        {
            title: 'Search Sites',
            description: 'Use this search bar to quickly find your sites.',
            icon: '🔍',
            target: '[data-tour="mobile-search"]',
            position: 'bottom'
        },
        {
            title: "You're All Set!",
            description: 'Start adding your sites and organizing them your way. Have fun!',
            icon: '🎉',
            target: null
        }
    ], []);

    // Use appropriate steps based on device
    const steps = isMobile ? mobileSteps : desktopSteps;

    const updateHighlight = useCallback(() => {
        const step = steps[currentStep];
        if (!step?.target) {
            setHighlightRect(null);
            return;
        }

        const element = document.querySelector(step.target);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 8;
            setHighlightRect({
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + padding * 2,
                height: rect.height + padding * 2,
                position: step.position || 'bottom'
            });
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setHighlightRect(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep]);

    // Track if main onboarding is completed
    const [onboardingCompleted, setOnboardingCompleted] = useState(false);
    const [addSiteTourCompleted, setAddSiteTourCompleted] = useState(false); // One-time post-tour for Add Site
    const [isPostTour, setIsPostTour] = useState(false); // Track if this is the post-main-tour Add Site tour
    const [hideTooltipOnly, setHideTooltipOnly] = useState(false); // Hide tooltip but keep glow for post-tour

    // Check user metadata on mount for tour completion states
    useEffect(() => {
        const checkTourStatus = async () => {
            if (!user?.id || !supabase) return;
            try {
                const { data: { user: authUser } } = await supabase.auth.getUser();
                const hasCompletedOnboarding = authUser?.user_metadata?.onboarding_completed;
                const hasCompletedAddSiteTour = authUser?.user_metadata?.add_site_tour_completed;

                setOnboardingCompleted(hasCompletedOnboarding || false);
                setAddSiteTourCompleted(hasCompletedAddSiteTour || false);

                // Show main tour for new users
                if (!hasCompletedOnboarding) {
                    setTimeout(() => setIsOpen(true), 1000);
                }
            } catch (err) {
                console.error('[OnboardingTour] Error:', err);
            }
        };
        checkTourStatus();
    }, [user?.id]);

    // Watch for Add button click after main tour is completed (one time only) - DESKTOP ONLY
    useEffect(() => {
        if (isMobile || !onboardingCompleted || addSiteTourCompleted || isOpen) return;

        const addButton = document.querySelector('[data-tour="add-button"]');
        if (!addButton) return;

        const handleAddButtonClick = () => {
            // Start one-time Add Site tour
            setTimeout(() => {
                setIsPostTour(true);
                setInAddSiteFlow(true);
                setCurrentStep(2); // Fill Site Details step (modal)
                setIsOpen(true);
            }, 300);
        };

        addButton.addEventListener('click', handleAddButtonClick);
        return () => addButton.removeEventListener('click', handleAddButtonClick);
    }, [isMobile, onboardingCompleted, addSiteTourCompleted, isOpen]);

    // Watch for site modal appearing (step 2: Fill Site Details) - DESKTOP ONLY
    useEffect(() => {
        if (isMobile || !isOpen || currentStep !== 2) return;

        const checkForModal = () => {
            const modal = document.querySelector('[data-tour="site-modal"]');
            if (modal) {
                updateHighlight();
            }
        };

        // Check immediately and then poll for modal
        const interval = setInterval(checkForModal, 200);
        checkForModal();

        return () => clearInterval(interval);
    }, [isOpen, currentStep, updateHighlight]);

    // Auto-open menu when going to steps that require it
    useEffect(() => {
        if (!isOpen || !isMobile) return;

        const step = steps[currentStep];
        if (step?.requiresMenu) {
            // Check if sidebar is open, if not - open it
            const sidebar = document.querySelector('[data-tour="mobile-sidebar"]');
            const isMenuOpen = sidebar && getComputedStyle(sidebar).transform === 'none';

            if (!isMenuOpen) {
                const menuButton = document.querySelector('[data-tour="mobile-menu"]');
                if (menuButton) {
                    menuButton.click();
                    // Update highlight after menu animation completes
                    setTimeout(updateHighlight, 350);
                }
            } else {
                // Menu already open, just update highlight
                updateHighlight();
            }
        }
    }, [isOpen, currentStep, isMobile, steps, updateHighlight]);

    // Watch for site being added - move to Site Card step - DESKTOP ONLY
    useEffect(() => {
        if (isMobile) {
            prevSitesCountRef.current = sites?.length || 0;
            return;
        }
        const sitesCount = sites?.length || 0;
        const prevCount = prevSitesCountRef.current;

        // If a site was just added during main tour modal step
        if (isOpen && sitesCount > prevCount && currentStep === 2) {
            setTimeout(() => {
                setCurrentStep(3); // Site Card Actions step
            }, 500);
        }

        // If a site was just added during post-tour (tour closed but isPostTour still true)
        if (!isOpen && isPostTour && sitesCount > prevCount) {
            setTimeout(() => {
                setCurrentStep(3); // Site Card Actions step
                setIsOpen(true); // Reopen tour for site card
            }, 500);
        }

        prevSitesCountRef.current = sitesCount;
    }, [sites?.length, isOpen, currentStep, isPostTour, isMobile]);

    useEffect(() => {
        if (isOpen) {
            updateHighlight();
            window.addEventListener('resize', updateHighlight);
            window.addEventListener('scroll', updateHighlight, true);
            return () => {
                window.removeEventListener('resize', updateHighlight);
                window.removeEventListener('scroll', updateHighlight, true);
            };
        }
    }, [isOpen, currentStep, updateHighlight]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') handleComplete();
            if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
            if (e.key === 'ArrowLeft') handlePrevious();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentStep]);

    // Block tab clicks and multi-select during tour
    useEffect(() => {
        if (!isOpen) return;

        const blockClicks = (e) => {
            const target = e.target.closest('[data-tour]');
            if (!target) return;

            const tourAttr = target.getAttribute('data-tour');
            // Block tab clicks and multi-select during tour - ALWAYS block navigation
            const blockedTargets = ['sites-tab', 'favorites-tab', 'categories-tab', 'tags-tab', 'settings-tab', 'select-mode'];

            if (blockedTargets.includes(tourAttr)) {
                // Always block during tour - no navigation allowed
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        };

        document.addEventListener('click', blockClicks, true);
        return () => document.removeEventListener('click', blockClicks, true);
    }, [isOpen, currentStep, steps]);

    const handleNext = () => {
        // If this is post-tour Add Site flow - DESKTOP ONLY
        if (isPostTour && !isMobile) {
            // If on Fill Site Details (step 2), just close tour - modal stays open
            // Site card tour will appear when site is added
            if (currentStep === 2) {
                setIsOpen(false);
                // Don't reset isPostTour yet - we need it for site card tour
                return;
            }
            // If on site card step (3), finish the post-tour completely
            if (currentStep === 3) {
                handleComplete();
                return;
            }
        }

        let nextStep = currentStep + 1;

        // Desktop-only: skip modal/site card steps logic
        if (!isMobile) {
            const addSiteStepIndex = 1;
            const modalStepIndex = 2;
            const firstTabStepIndex = 4; // "Sites Tab" on desktop

            // If on "Add Your First Site" step and user clicks Next (not the button),
            // skip modal and site card steps, go directly to tabs
            if (currentStep === addSiteStepIndex && !inAddSiteFlow) {
                nextStep = firstTabStepIndex;
            }

            // If on Fill Site Details (modal step) and user clicks Next,
            // close modal and skip to tabs
            if (currentStep === modalStepIndex) {
                const modalCloseBtn = document.querySelector('[data-tour="site-modal"]')?.closest('.fixed')?.querySelector('button');
                if (modalCloseBtn) {
                    modalCloseBtn.click();
                }
                setInAddSiteFlow(false);
                nextStep = firstTabStepIndex;
            }
        }

        // Close mobile menu if leaving menu tabs section (going to search or done)
        if (isMobile && steps[currentStep]?.requiresMenu && !steps[nextStep]?.requiresMenu) {
            const sidebarCloseBtn = document.querySelector('[data-tour="mobile-sidebar"] button[aria-label="Close sidebar"]');
            if (sidebarCloseBtn) {
                sidebarCloseBtn.click();
            }
        }

        // Skip waitForElement steps if not in add site flow
        while (nextStep < steps.length - 1) {
            const step = steps[nextStep];
            if (step.waitForElement && !inAddSiteFlow && !document.querySelector(step.target)) {
                nextStep++;
            } else {
                break;
            }
        }

        if (nextStep < steps.length) {
            setCurrentStep(nextStep);
        } else {
            handleComplete();
        }
    };

    const handlePrevious = () => {
        // If this is post-tour, just close
        if (isPostTour) {
            handleComplete();
            return;
        }

        let prevStep = currentStep - 1;

        // Skip optional steps if their target doesn't exist
        while (prevStep > 0) {
            const step = steps[prevStep];
            if (step.optional && step.target && !document.querySelector(step.target)) {
                prevStep--;
            } else {
                break;
            }
        }

        if (prevStep >= 0) {
            setCurrentStep(prevStep);
        }
    };

    const handleComplete = async () => {
        // Save onboarding_completed when main tour finishes
        if (supabase && !onboardingCompleted && !isPostTour) {
            try {
                await supabase.auth.updateUser({
                    data: { onboarding_completed: true }
                });
                setOnboardingCompleted(true);
            } catch (err) {
                console.error('[OnboardingTour] Error:', err);
            }
        }

        // Mark add site tour as completed (one-time only)
        if (isPostTour) {
            setAddSiteTourCompleted(true);
            // Optionally save to user metadata
            if (supabase) {
                try {
                    await supabase.auth.updateUser({
                        data: { add_site_tour_completed: true }
                    });
                } catch (err) {
                    console.error('[OnboardingTour] Error:', err);
                }
            }
        }

        setIsOpen(false);
        setIsPostTour(false);
        setInAddSiteFlow(false);
        setHideTooltipOnly(false);
        if (onComplete) onComplete();
    };

    if (!isOpen) return null;

    const currentStepData = steps[currentStep];
    // Post-tour shows only modal and site card steps
    const isMiniTour = isPostTour;
    const isFirstStep = isPostTour ? true : currentStep === 0;
    // For post-tour, site card (step 3) is last; otherwise use steps.length
    const isLastStep = isPostTour ? currentStep === 3 : currentStep === steps.length - 1;

    const getTooltipStyle = () => {
        if (!highlightRect) {
            return {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)'
            };
        }

        const padding = isMobile ? 12 : 16;
        const tooltipWidth = isMobile ? 288 : 320; // w-72 vs w-80
        const tooltipHeight = isMobile ? 160 : 200;

        let top, left;

        switch (highlightRect.position) {
            case 'top':
                top = highlightRect.top - tooltipHeight - padding;
                left = highlightRect.left + (highlightRect.width / 2) - (tooltipWidth / 2);
                break;
            case 'bottom':
            default:
                top = highlightRect.top + highlightRect.height + padding;
                left = highlightRect.left + (highlightRect.width / 2) - (tooltipWidth / 2);
                break;
            case 'left':
                top = highlightRect.top + (highlightRect.height / 2) - (tooltipHeight / 2);
                left = highlightRect.left - tooltipWidth - padding;
                break;
            case 'right':
                top = highlightRect.top + (highlightRect.height / 2) - (tooltipHeight / 2);
                left = highlightRect.left + highlightRect.width + padding;
                break;
        }

        left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
        top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

        return { top: `${top}px`, left: `${left}px` };
    };

    // For modal/site card steps, allow interaction with the element - DESKTOP ONLY
    const isModalStep = !isMobile && currentStep === 2;
    const isSiteCardStep = !isMobile && currentStep === 3;
    const isInteractiveStep = isModalStep || isSiteCardStep;

    return (
        <div className={`fixed inset-0 ${isInteractiveStep ? 'z-[9998] pointer-events-none' : 'z-[9999]'}`}>
            {/* Dark overlay with spotlight cutout - hide for interactive steps */}
            {!isInteractiveStep && (
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                    <defs>
                        <mask id="spotlight-mask">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            {highlightRect && (
                                <rect
                                    x={highlightRect.left}
                                    y={highlightRect.top}
                                    width={highlightRect.width}
                                    height={highlightRect.height}
                                    rx="12"
                                    fill="black"
                                />
                            )}
                        </mask>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.8)"
                        mask="url(#spotlight-mask)"
                    />
                </svg>
            )}

            {/* Clickable area for highlighted element - NOT for modal/site card steps as we need full interaction */}
            {highlightRect && !isInteractiveStep && (
                <div
                    className="absolute rounded-xl cursor-pointer z-10"
                    style={{
                        top: highlightRect.top,
                        left: highlightRect.left,
                        width: highlightRect.width,
                        height: highlightRect.height,
                        pointerEvents: 'auto'
                    }}
                    onClick={() => {
                        // Click the actual element
                        const element = document.querySelector(steps[currentStep]?.target);
                        if (element) {
                            element.click();
                        }

                        // Desktop: If on "Add Your First Site" step (1), enter add site flow
                        if (!isMobile && currentStep === 1) {
                            setInAddSiteFlow(true);
                            setCurrentStep(2); // Move to "Fill Site Details" step
                        } else if (isMobile && currentStep === 1) {
                            // Mobile: just open the modal, don't advance tour
                            // User can close modal and click Next to continue
                            return;
                        } else if (steps[currentStep]?.target === '[data-tour="mobile-menu"]') {
                            // If clicking mobile menu, wait for menu to open then advance
                            setTimeout(() => {
                                setCurrentStep(currentStep + 1);
                            }, 350);
                        } else {
                            // For other steps, auto-advance to next step
                            handleNext();
                        }
                    }}
                />
            )}

            {/* Highlight border glow - ONLY for modal (step 2) and site card (step 3) */}
            {highlightRect && isInteractiveStep && (
                <div
                    className="absolute rounded-xl border-2 border-app-accent shadow-[0_0_0_4px_rgba(139,92,246,0.3),0_0_20px_rgba(139,92,246,0.4)] transition-all duration-300 pointer-events-none animate-pulse z-[10001]"
                    style={{
                        top: highlightRect.top,
                        left: highlightRect.left,
                        width: highlightRect.width,
                        height: highlightRect.height,
                    }}
                />
            )}

            {/* Clickable overlay to close */}
            <div
                className="absolute inset-0"
                onClick={handleComplete}
                style={{ pointerEvents: highlightRect || isInteractiveStep ? 'none' : 'auto' }}
            />

            {/* Tooltip Card - hide when hideTooltipOnly is true (post-tour glow only mode) */}
            {!hideTooltipOnly && (
                <div
                    className={`absolute w-72 sm:w-80 bg-app-bg-secondary border border-app-border rounded-xl sm:rounded-2xl shadow-2xl p-3 sm:p-5 transition-all duration-300 ${isModalStep ? 'z-[10000]' : ''}`}
                    style={{ ...getTooltipStyle(), pointerEvents: 'auto' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-2xl sm:text-4xl mb-2 sm:mb-3 text-center">
                        {currentStepData.icon}
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-app-text-primary mb-1 sm:mb-2 text-center">
                        {currentStepData.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-app-text-secondary mb-3 sm:mb-4 text-center leading-relaxed">
                        {currentStepData.description}
                    </p>

                    {/* Progress dots - hide for mini tours */}
                    {!isMiniTour && (
                        <div className="flex justify-center gap-1 sm:gap-1.5 mb-3 sm:mb-4">
                            {steps.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentStep(index)}
                                    className={`h-1.5 sm:h-2 rounded-full transition-all ${index === currentStep
                                            ? 'w-4 sm:w-6 bg-app-accent'
                                            : index < currentStep
                                                ? 'w-1.5 sm:w-2 bg-app-accent/50 hover:bg-app-accent/70'
                                                : 'w-1.5 sm:w-2 bg-app-border hover:bg-app-text-tertiary'
                                        }`}
                                />
                            ))}
                        </div>
                    )}

                    {/* Navigation buttons */}
                    <div className="flex gap-2 justify-between">
                        {!isMiniTour && (
                            <button
                                onClick={handleComplete}
                                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-app-text-tertiary hover:text-app-text-secondary transition-colors"
                            >
                                Skip
                            </button>
                        )}

                        <div className={`flex gap-2 ${isMiniTour ? 'w-full justify-center' : ''}`}>
                            {!isFirstStep && !isMiniTour && (
                                <button
                                    onClick={handlePrevious}
                                    className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm bg-app-bg-light border border-app-border text-app-text-primary rounded-lg hover:bg-app-bg-lighter transition-colors"
                                >
                                    ←
                                </button>
                            )}
                            <button
                                onClick={handleNext}
                                className="px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm bg-app-accent text-white rounded-lg hover:bg-app-accentLight transition-colors font-medium"
                            >
                                {isMiniTour ? 'Got it!' : isLastStep ? 'Done' : 'Next →'}
                            </button>
                        </div>
                    </div>

                    {!isMiniTour && (
                        <p className="text-[9px] sm:text-[10px] text-app-text-tertiary mt-2 sm:mt-3 text-center hidden sm:block">
                            Use arrow keys to navigate • Esc to skip
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
