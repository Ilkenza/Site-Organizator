import { useState } from 'react';
import dynamic from 'next/dynamic';

const StorageList = dynamic(() => import('./StorageList'));
const CoursesList = dynamic(() => import('./CoursesList'));

const SUB_TABS = [
    { id: 'storage', label: 'Storage Map' },
    { id: 'courses', label: 'Courses' },
];

export default function MapsView() {
    const [activeSubTab, setActiveSubTab] = useState('storage');

    return (
        <div className="p-3 sm:p-6">
            {/* Sub-tab bar */}
            <div className="flex gap-1 mb-4 bg-app-bg-secondary rounded-lg p-1 border border-app-border w-fit">
                {SUB_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSubTab(tab.id)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors
                            ${activeSubTab === tab.id
                                ? 'bg-app-accent/20 text-app-accent'
                                : 'text-app-text-secondary hover:text-app-text-primary hover:bg-app-bg-light'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Sub-tab content */}
            {activeSubTab === 'storage' && <StorageList />}
            {activeSubTab === 'courses' && <CoursesList />}
        </div>
    );
}
