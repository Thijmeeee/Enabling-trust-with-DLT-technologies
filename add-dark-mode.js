// Quick script to add dark mode classes to components
// This will be run manually to bulk update files

const fs = require('fs');
const path = require('path');

const replacements = [
    // Backgrounds
    { from: 'bg-white"', to: 'bg-white dark:bg-gray-800"' },
    { from: 'bg-gray-50"', to: 'bg-gray-50 dark:bg-gray-900"' },
    { from: 'bg-gray-100"', to: 'bg-gray-100 dark:bg-gray-700"' },

    // Borders
    { from: 'border-gray-200"', to: 'border-gray-200 dark:border-gray-700"' },
    { from: 'border-gray-300"', to: 'border-gray-300 dark:border-gray-600"' },

    // Text
    { from: 'text-gray-900"', to: 'text-gray-900 dark:text-white"' },
    { from: 'text-gray-800"', to: 'text-gray-800 dark:text-gray-200"' },
    { from: 'text-gray-700"', to: 'text-gray-700 dark:text-gray-300"' },
    { from: 'text-gray-600"', to: 'text-gray-600 dark:text-gray-400"' },
];

// Files to process
const filesToProcess = [
    './src/components/IntroductionPage.tsx',
    './src/components/dashboards/ManufacturerSimpleDashboard.tsx',
    './src/components/dashboards/RecyclerDashboard.tsx',
    './src/components/dashboards/SupervisorDashboard.tsx',
    './src/components/dashboards/ConsumerView.tsx',
];

console.log('Adding dark mode classes to components...');

filesToProcess.forEach(filePath => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        replacements.forEach(({ from, to }) => {
            const originalContent = content;
            // Only replace if dark: is not already present
            content = content.replace(new RegExp(from.replace(/"/g, ''), 'g'), (match) => {
                // Check if dark: already exists nearby
                const index = content.indexOf(match);
                const context = content.substring(Math.max(0, index - 50), index + match.length + 50);
                if (context.includes('dark:')) {
                    return match;
                }
                return to.replace(/"/g, '');
            });

            if (content !== originalContent) {
                modified = true;
            }
        });

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Updated ${filePath}`);
        } else {
            console.log(`⏭️  Skipped ${filePath} (no changes needed)`);
        }
    } catch (error) {
        console.error(`❌ Error processing ${filePath}:`, error.message);
    }
});

console.log('Done!');
