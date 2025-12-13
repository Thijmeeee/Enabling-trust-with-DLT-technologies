const fs = require('fs');

function addDarkModeClasses(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add dark:bg-gray-800 to bg-white
    content = content.replace(/className="([^"]*)\bbg-white\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:bg-')) return match;
        return `className="${before}bg-white dark:bg-gray-800${after}"`;
    });

    // Add dark:text-white to text-gray-900
    content = content.replace(/className="([^"]*)\btext-gray-900\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:text-')) return match;
        return `className="${before}text-gray-900 dark:text-white${after}"`;
    });

    // Add dark:text-gray-300 to text-gray-700
    content = content.replace(/className="([^"]*)\btext-gray-700\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:text-')) return match;
        return `className="${before}text-gray-700 dark:text-gray-300${after}"`;
    });

    // Add dark:text-gray-400 to text-gray-600
    content = content.replace(/className="([^"]*)\btext-gray-600\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:text-')) return match;
        return `className="${before}text-gray-600 dark:text-gray-400${after}"`;
    });

    // Add dark:border-gray-700 to border-gray-200
    content = content.replace(/className="([^"]*)\bborder-gray-200\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:border-')) return match;
        return `className="${before}border-gray-200 dark:border-gray-700${after}"`;
    });

    // Add dark:bg-gray-900 to bg-gray-50
    content = content.replace(/className="([^"]*)\bbg-gray-50\b([^"]*)"/g, (match, before, after) => {
        if (match.includes('dark:bg-')) return match;
        return `className="${before}bg-gray-50 dark:bg-gray-900${after}"`;
    });

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
}

// Process dashboards
const dashboards = [
    'src/components/dashboards/RecyclerDashboard.tsx',
    'src/components/dashboards/SupervisorDashboard.tsx',
    'src/components/dashboards/ResolverDashboard.tsx'
];

dashboards.forEach(dashboard => {
    try {
        addDarkModeClasses(dashboard);
    } catch (err) {
        console.error(`Error processing ${dashboard}:`, err.message);
    }
});

console.log('All dashboards updated with dark mode classes!');
