/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#ff5f86',
                    light: '#ff84a3',
                    dark: '#e5426d',
                },
                accent: {
                    DEFAULT: '#5bc8b8',
                    light: '#c5f2ea',
                    dark: '#339f91',
                },
                pastel: {
                    pink: '#ffe9f2',
                    peach: '#ffe8cf',
                    cream: '#fffdf8',
                    rose: '#fff3ee',
                },
            },
            fontFamily: {
                display: ['Fredoka', 'Baloo 2', 'sans-serif'],
                body: ['Baloo 2', 'sans-serif'],
            },
            borderRadius: {
                '2xl': '20px',
                '3xl': '28px',
            },
            boxShadow: {
                'soft': '0 6px 16px rgba(26, 34, 47, 0.08)',
                'card': '0 14px 28px rgba(26, 34, 47, 0.1)',
                'hover': '0 16px 30px rgba(255, 95, 134, 0.22)',
            },
            animation: {
                'scroll': 'scroll 60s linear infinite',
                'fade-in': 'fadeIn 0.5s ease-in-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                scroll: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
            },
        },
    },
    plugins: [],
}
