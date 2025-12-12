import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>(() => {
        // Initialize from localStorage or default to light
        const savedTheme = localStorage.getItem('theme') as Theme;
        return savedTheme || 'light';
    });

    useEffect(() => {
        console.log('Theme changed to:', theme);
        // Apply theme to document root
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
            console.log('Added dark class to HTML element');
        } else {
            root.classList.remove('dark');
            console.log('Removed dark class from HTML element');
        }

        // Save to localStorage
        localStorage.setItem('theme', theme);
        console.log('Saved theme to localStorage:', theme);
    }, [theme]);

    const toggleTheme = () => {
        console.log('Toggle theme called, current theme:', theme);
        setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
